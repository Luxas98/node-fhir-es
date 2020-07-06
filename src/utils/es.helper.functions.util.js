const esb = require('elastic-builder');
const { CLIENT } = require('../constants');
const { resolveSchema } = require('../node-fhir-server');
const { referenceQuery, identifierQuery, dateQuery } = require('./es.querybuilder.util');
const globals = require('../globals');
const logger = require('../node-fhir-server').loggers.get();
let esClient = globals.get(CLIENT);
const moment = require('moment-timezone');

let getResource = (base_version, resourceType) => {
	return require(resolveSchema(base_version, resourceType));};

let applyGenericSearchParams = (query, args) => {
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag, _has, _page} = args;

	// Search Result params
	let { _include, _revinclude, _sort, _rawresource, _count, _summary, _elements, _contained, _containedtype } = args;

	let requestBody = esb.requestBodySearch();

	if (_id) {
		query = query.should(esb.termQuery('id', _id));
		let identifierQueries = identifierQuery('identifier', _id);
		identifierQueries.forEach((es_query) => {
			query = query.should(es_query);
		});
	}

	if (_content) {
		query = query.should(esb.queryStringQuery(_content));
	}

	if (_text) {
		query = query.should(esb.queryStringQuery(_text));
	}

	if (_lastUpdated) {
		query = dateQuery(query, 'meta.lastUpdated', _lastUpdated);
	}

	_page = _page || 0;
	_count = _count || 100;

	requestBody = requestBody.query(query).from(_page * _count).size(_count);

	if (_sort) {
		requestBody = requestBody.sorts(_sort);
	}

	if (_elements) {
		requestBody.source(_elements);
	}

	return requestBody;
};

let argsToUrl = (args) => {
	let elements = [];
	Object.keys(args).forEach((key) => {
		if (typeof args[key] === 'object') {
			elements.push(argsToUrl(args[key]));
		} else {
			elements.push(`${key}=${args[key]}`);
		}
	});

	return elements.join('&');
};

let search = (query, indexName, args, resolve, reject) => {
	let { base_version, _rawresource } = args;

	let requestBody = applyGenericSearchParams(query, args);

	args['_page'] = (requestBody._body.from / requestBody._body.size) + 1;
	args['_count'] = requestBody._body.size;
	logger.info(requestBody.toJSON());
	let resourceType = 'Bundle';
	return esClient.search({
		index: indexName,
		body: requestBody.toJSON()
	}).then((result) => {
		let resources = [];
		result.body.hits.hits.forEach((es_result) => {
			resourceType = es_result._source['resourceType'];
			let ResourceClass = getResource(base_version, es_result._source['resourceType']);
			let resource = new ResourceClass(es_result._source);
			resources.push({resource: resource});
		});
		if (_rawresource) {
			resolve(resources);
		} else {
			let BundleClass = getResource(base_version, 'Bundle');
			let result_bundle = new BundleClass({type: 'searchset', entry: resources, link: { url: { next: `/${args['base_version']}/${resourceType}?${argsToUrl(args)}`}}});
			resolve(result_bundle);
		}
	}).catch((error) => {
		logger.info(`${indexName} >>> ${error.toString()}`);
		if (_rawresource) {
			resolve([]);
		} else {
			let BundleClass = getResource(base_version, 'Bundle');
			resolve(new BundleClass({type: 'searchset', entry: []}));
		}
	});
};

let searchReferenecePromise = (searchReferenecePromises, referenceResultMapping, query, indexName, args, resolve, reject) => {
	let { base_version, _rawresource } = args;

	let default_bundle;
	if (_rawresource) {
		default_bundle = [];

	} else {
		let BundleClass = getResource(base_version, 'Bundle');
		default_bundle = new BundleClass({type: 'searchset', entry: []});
	}

	Promise.all(searchReferenecePromises).then((results) =>
		{
			if (results.length > 0) {
				// TODO: figure out iteration if results are empty and we can have different reference fields
				if (results[0].length > 0) {
					results[0].forEach((_resource) => {
						_resource = _resource['resource'];
						if (_resource.__proto__.constructor.name in referenceResultMapping) {
							let rq = referenceQuery(referenceResultMapping[_resource.__proto__.constructor.name], _resource.id);
							rq.forEach((_query) => {
								query = query.should(_query);
							});
						}
					});

					search(query, indexName, args, resolve, reject);
				} else {
					resolve(default_bundle);
				}
			} else {
				resolve(default_bundle);
			}
		}
	).catch((error) => {
		logger.error('Preference search >>>' + error.toString());
		resolve(default_bundle);
	});
};

let searchId = (id, indexName, ResourceClass, resolve, reject, resourceName) => {
	return esClient.get({
		index: indexName,
		id: id
	}).then((es_result) => {
		if (es_result.body.found) {
			let es_source = es_result.body._source;
			let resource = new ResourceClass(es_source);
			resolve(resource);
		} else {
			resolve();
		}
	}).catch((error) => {
		logger.error(resourceName + ' searchId >>>' + error.toString());
		// reject(error);
		resolve();
	});
};

let create = (resource, indexName, ResourceClass, MetaClass, resolve, reject) => {
	// Cast resource to Encounter Class
	logger.info(`${indexName} create resource >>> ${JSON.stringify(resource)}`);

	let _resource = new ResourceClass(resource);
	_resource.meta = new MetaClass({
		'lastUpdated': moment.utc().format('YYYY-MM-DDTHH:mm:ssZ'),
		'versionId': 1
	});

	let str_resource = JSON.stringify(_resource);
	logger.info(`${indexName} create ResourceClass >>> ${str_resource}`);

	// Index resource
	esClient.index({
		index: indexName,
		body: _resource,
		id: _resource.id
	}).then((response) => {
		logger.info(`${indexName} create >>> ${JSON.stringify(response)}`);
		return response;
	}).then((response) => {
		esClient.index({
			index: `${indexName}_history`,
			body: _resource
		}).catch((error) => {
			logger.error(indexName + ' history create >>>' + error.toString());
			reject(error);
		});
		resolve(response);
	}).catch((error) => {
		logger.error(indexName + ' create >>>' + error.toString());
		reject(error);
	});

};

let update = (id, resource, indexName, ResourceClass, MetaClass, resolve, reject, resourceName) => {
	esClient.get({
		id: id,
		index: indexName
	}).then((get_es_result) => {
		let resourceObject = new ResourceClass(resource);
		let meta;
		if (get_es_result.body.found) {
			meta = new MetaClass(get_es_result.body._source.meta);
			meta.lastUpdated = moment.utc().format('YYYY-MM-DDTHH:mm:ssZ');
			meta.versionId += 1;
		} else {
			meta = new MetaClass({
				'lastUpdated': moment.utc().format('YYYY-MM-DDTHH:mm:ssZ'),
				'versionId': 1
			});
		}

		if (meta) {
			resourceObject.meta = meta;
		}

		esClient.update({
			id: id,
			index: indexName,
			body: {
				doc: resourceObject
			},
			retry_on_conflict: 0
		}).then((data) => {
			logger.info(resourceName + ' >>> update >>> success');
			return esClient.get({
				index: indexName,
				id: data.body._id
			}).then((_es_result) => {
				if (_es_result.body.found) {
					let updated_resource = _es_result.body._source;
					let result_resource = new ResourceClass(updated_resource);
					logger.info(resourceName + ' >>> update >>> resolving');
					return result_resource;
				} else {
					return {};
				}
			}).catch((error) => {
				logger.info(resourceName + ' >>> ' + error.toString());
				reject(error);
			});
		}).then((result_resource) => {
			// TODO: does not seem to return anything

			esClient.index({
				index: `${indexName}_history`,
				body: result_resource
			}).create((error) => {
				logger.error(indexName + ' history update >>>' + error.toString());
				reject(error);
			});

			return result_resource;
		}).catch((error) => {
			logger.info(resourceName + ' update >>> ' + error.toString());
			reject(error);
		});
	}).then((result_resource) => {
		resolve(result_resource);
	});
};

let _delete = (id, indexName, resolve, reject) => {
	esClient.delete({
		index: indexName,
		id: id
	}).then((response) => {
		resolve(response);
	}).catch((error) => {
		logger.error(indexName + ' delete >>>' + error.toString());
	});
};

module.exports = {
	create,
	_delete,
	search,
	searchReferenecePromise,
	searchId,
	update
};
