const sanitize = require('sanitize-html');
const errors = require('./error.utils');
const validator = require('validator');
const xss = require('xss');

let parseValue = function(type, value) {
	let result;
	let splitted;
	switch (type) {
		case 'number':
			result = validator.toFloat(value);
			break;
		case 'date':
			result = validator.stripLow(xss(sanitize(value)));
			break;
		case 'boolean':
			result = validator.toBoolean(value);
			break;
		case 'string':
		case 'reference':
		case 'uri':
		case 'token':
			// strip any html tags from the query
			// xss helps prevent html from slipping in
			// strip a certain range of unicode characters
			// replace any non word characters
			result = validator.stripLow(xss(sanitize(value)));
			break;
		case 'json_string':
			result = JSON.parse(value);
			break;
		case 'quantity':
			splitted = value.split('|');
			if (splitted.length > 1) {
				result = {
					'value': splitted[0],
					'system': splitted[1],
					'unit': splitted[2]
				};
			}
			else {
				result = {
					'code': splitted[0]
				};
			}
			break;
		default:
			// Pass the value through, unknown types will fail when being validated
			result = value;
			break;
	}
	return result;
};

let validateType = function(type, value) {
	let result;
	switch (type) {
		case 'number':
			result = typeof value === 'number' && !Number.isNaN(value);
			break;
		case 'boolean':
			result = typeof value === 'boolean';
			break;
		case 'reference':
			result = (typeof value === 'object') || (typeof value === 'string');
			break;
		case 'string':
		case 'uri':
		case 'token':
		case 'date':
			result = typeof value === 'string';
			break;
		case 'json_string':
			result = typeof value === 'object';
			break;
		case 'quantity':
			result = typeof value === 'object';
			break;
		default:
			result = false;
			break;
	}
	return result;
};

let parseParams = req => {
	let params = {};
	let isSearch = req.url && req.url.endsWith('_search');

	if (req.query && req.method === 'GET' && Object.keys(req.query).length) {
		Object.assign(params, req.query);
	}
	if (req.body && ['PUT', 'POST'].includes(req.method) && Object.keys(req.body).length && isSearch) {
		Object.assign(params, req.body);
	}
	if (req.params && Object.keys(req.params).length) {
		Object.assign(params, req.params);
	}
	return params;
};

let findMatchWithName = (name = '', params = {}) => {
	let keys = Object.getOwnPropertyNames(params);
	let match = keys.find(key => {
		let parameter = key.split('.')[0];
		// let parameter = key.split(':')[0];
		return name === parameter;
	});
	return { field: match, value: params[match] };
};

let findHasKeysValues = (query) => {
	let has_keys_values = [];
	Object.keys(query).forEach((key) => {
		if (key.match('_has:*')) {
			let new_key_name = key.match('(?<=_has:)[a-zA-Z:0-9-]*');
			has_keys_values.push({[new_key_name]: query[key]});
		}
	});

	return has_keys_values;
};

// let processReferenceValues = (name = '', params = {}) => {
//
// };

/**
 * @function sanitizeMiddleware
 * @summary Sanitize the arguments by removing extra arguments, escaping some, and
 * throwing errors if arg should throw when an invalid one is passed. This will replace
 * req.body and/or req.params with a clean object
 * @param {Array<Object>} config - Sanitize config for how to deal with params
 * @param {string} config.name - Argument name
 * @param {string} config.type - Argument type. Acceptable types are (boolean, string, number)
 * @param {boolean} required - Should we throw if this argument is present and invalid, default is false
 */
let sanitizeMiddleware = function(config) {
	return function(req, res, next) {
		let currentArgs = parseParams(req);
		let cleanArgs = {};
		// filter only ones with version or no version
		let version_specific_params = config.filter(param => {
			return !param.versions || param.versions === req.params.base_version;
		});

		//process _has parameter
		let has_values = findHasKeysValues(req.query);

		has_values.forEach((has_value) => {
			if (!('_has' in cleanArgs)) {
				cleanArgs['_has'] = [];
			}
			cleanArgs['_has'].push(has_value);
		});

		//process _elements parameter
		if (req.query['_elements']) {
			if (Array.isArray(req.query['_elements'])) {
				cleanArgs['_ELEMENTS'] = req.query['_elements'];
			} else {
				cleanArgs['_ELEMENTS'] = req.query['_elements'].split(',');
			}
		}

		// For search
		if (req.query['_type']) {
			cleanArgs['_type'] = req.query['_type'];
		}

		if (req.query['_text']) {
			cleanArgs['_text'] = req.query['_text'];
		}

		if (req.query['_count']) {
			cleanArgs['_count'] = req.query['_count'];
		}

		if (req.query['_page']) {
			cleanArgs['_page'] = req.query['_page'];
		}

		// Check each argument in the config
		for (let i = 0; i < version_specific_params.length; i++) {
			let conf = version_specific_params[i];
			let { field, value } = findMatchWithName(conf.name, currentArgs);

			// If the argument is required but not present
			if (!value && conf.required) {
				return next(errors.invalidParameter(conf.name + ' is required', req.params.base_version));
			}

			// Try to cast the type to the correct type, do this first so that if something
			// returns as NaN we can bail on it
			try {
				if (value) {
					if (conf.type === 'reference') {
						if (field.indexOf('.') > -1) {
							let [root, ...subfield ] = field.split('.');
							subfield = subfield.join('.');
							if (Object.values(cleanArgs).indexOf(field) > 0) {
								cleanArgs[root].set(subfield, parseValue(conf.type, value));
							} else {
								cleanArgs[root] = {
									[subfield]: parseValue(conf.type, value)
								};
							}
						} else {
							cleanArgs[field] = {
								id: parseValue(conf.type, value)
							};
						}
					} else {
						cleanArgs[field] = parseValue(conf.type, value);
					}

				}
			} catch (err) {
				return next(errors.invalidParameter(conf.name + ' is invalid', req.params.base_version));
			}

			// If we have the arg and the type is wrong, throw invalid arg
			if (cleanArgs[field] !== undefined && !validateType(conf.type, cleanArgs[field])) {
				return next(errors.invalidParameter('Invalid parameter: ' + conf.name, req.params.base_version));
			}
		}

		// Save the cleaned arguments on the request for later use, we must only use these later on
		req.sanitized_args = cleanArgs;

		next();
	};
};

module.exports = {
	sanitizeMiddleware,
};
