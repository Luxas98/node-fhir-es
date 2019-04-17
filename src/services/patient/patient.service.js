/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('../../node-fhir-server');
const { identifierQuery, referenceQuery, dateQuery} = require('../../utils/es.querybuilder.util');
const { search: querySearch, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirpatient';
let resourceName = 'Patient';

let getBundle = (base_version) => {
	return require(resolveSchema(base_version, 'Bundle'));
};

let getPatient = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};


module.exports.everything = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> everything');

	let { base_version, id } = args;
	let relatedPromises = [];

	let Bundle = getBundle(base_version);
	let default_bundle = new Bundle({type: 'searchset', entry: []});

	this.searchById(args).then((patient) => {
		// Local import -> avoid cyclic imports throwing "undefined"
		const { search: encounterSearch } = require('../encounter/encounter.service');
		const { search: conditionSearch } = require('../condition/condition.service');
		const { search: procedureSearch } = require('../procedure/procedure.service');
		const { search: medicationAdministrationSearch } = require('../medicationadministration/medicationadministration.service');
		const { search: observationSearch } = require('../observation/observation.service');
		const { search: diagnosticReportSearch } = require('../diagnosticreport/diagnosticreport.service');

		let resultResources = [];
		if (!patient) {
			logger.info(`${resourceName} >>> ${id} >>> not found`);
			resolve(default_bundle);
			return;
		}

		resultResources.push({resource: patient});
		relatedPromises.push(procedureSearch({patient: id, base_version: base_version, _rawresource: true}));
		relatedPromises.push(conditionSearch({patient: id, base_version: base_version,_rawresource: true}));
		relatedPromises.push(medicationAdministrationSearch({patient: id, base_version: base_version, _rawresource: true}));
		relatedPromises.push(observationSearch({patient: id, base_version: base_version, _rawresource: true}));
		relatedPromises.push(diagnosticReportSearch({patient: id, base_version: base_version, _rawresource: true}));
		relatedPromises.push(encounterSearch({patient: id, base_version: base_version, _rawresource: true}));

		if (relatedPromises.length > 0) {
			Promise.all(relatedPromises).then((results) =>
				{
					results.forEach((resource) => {

						if (resource.constructor === Array) {
							resource.forEach((subresource) => {
								resultResources.push({resource: subresource});
							});
						} else {
							// TODO: add fullUrl to the properties -> meta data needed
							resultResources.push({resource: resource});
						}
					});
					let resultBundle = new Bundle({total: resultResources.length, type: 'searchset', entry: resultResources});
					resolve(resultBundle);
				}
			).catch((error) => {
				logger.info(resourceName + ' >>>' + error.toString());
				resolve(default_bundle);
			});
		}
	}).catch((error) => {
		logger.info(resourceName + ' >>>' + error.toString());
		resolve(default_bundle);
	});
});

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag, _has} = args;

	let active = args['active'];
	// TODO: not necessary for now, will look into it later
	// let address = args['address'];
	// let address_city = args['address-city'];
	// let address_country = args['address-country'];
	// let address_postalcode = args['address-postalcode'];
	// let address_state = args['address-state'];
	// let address_use = args['address-use'];

	let id = args['id'];
	let birthdate = args['birthdate'];
	let death_date = args['death-date'];
	let deceased = args['deceased'];
	let email = args['email'];
	let family = args['family'];
	let gender = args['gender'];
	let general_practitioner = args['general-practitioner'];
	let given = args['given'];
	let identifier = args['identifier'];
	let language = args['language'];
	// let link = args['link'];
	let name = args['name'];
	let organization = args['organization'];
	// TODO: not interesting for now
	// let phone = args['phone'];
	// let phonetic = args['phonetic'];
	// let telecom = args['telecom'];

	let boolQuery = esb.boolQuery();

	if (_id) {
		boolQuery = boolQuery.should(esb.termQuery('id', _id));
		let identifierQueries = identifierQuery('identifier', _id);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (_content) {
		boolQuery = boolQuery.should(esb.queryStringQuery(_content));
	}

	if (_text) {
		boolQuery = boolQuery.should(esb.queryStringQuery(_text));
	}
	// let hasRelatedPromises = [];
	// // TODO: have to rethink logic of this, seems way to complicated
	// // TODO: make this available for other resources
	// if (_has) {
	// 	logger.info(_has);
	// 	_has.forEach((reference_query) => {
	// 		for (let key in reference_query) {
	// 			let value = reference_query[key];
	// 			let parts = key.split(':');
	// 			let related_resource_name = parts[0];
	// 			let related_resource_field = parts[1];
	// 			if (related_resource_name === 'Observation') {
	// 				if (parts.length > 2) {
	// 					let related_field_object = {
	// 						[related_resource_field]: {
	// 							[parts[2]]: value
	// 						}
	// 					};
	// 					hasRelatedPromises.push(observationSearch({base_version: base_version, [related_resource_field]: related_field_object}));
	// 				} else {
	// 					hasRelatedPromises.push(observationSearch({base_version: base_version, [related_resource_field]: value}));
	// 				}
	// 			}
	// 		}
	// 	});
	// }
	if (id) {
		boolQuery = boolQuery.should(esb.termQuery('id', id));
		let identifierQueries = identifierQuery('identifier', id);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (active) {
		boolQuery = boolQuery.should(esb.termQuery('active', active));
	}

	if (birthdate) {
		boolQuery = dateQuery(boolQuery, 'birthDate', birthdate);
	}

	if (death_date) {
		boolQuery = dateQuery(boolQuery, 'deceasedDateTime', death_date);
	}

	if (deceased) {
		boolQuery = boolQuery.should(esb.termQuery('deceasedBoolean', deceased));
	}

	if (email) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('telecom.value', email), 'telecom'));
	}

	if (family) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.family', family), 'name'));
	}

	if (given) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.given', given), 'name'));
	}

	if (gender) {
		boolQuery = boolQuery.should(esb.termQuery('gender', gender));
	}

	if (general_practitioner) {
		let rq = referenceQuery('generalPractitioner', general_practitioner);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'generalPractitioner'));
		});
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (language) {
		boolQuery = boolQuery.should(esb.termQuery('communication.language.coding.display', language));
		boolQuery = boolQuery.should(esb.termQuery('communication.language.coding.code', language));
		boolQuery = boolQuery.should(esb.termQuery('communication.language.text', language));
	}

	if (name) {
		// TODO: test and maybe add search analyzer
		let parts = name.split(' ');
		if (parts.length === 1) {
			boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.given', parts[0]), 'name'));
			boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.family', parts[0]), 'name'));
		}

		if (parts.length > 1) {
			boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.given', parts[0]), 'name'));
			boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.family', parts[1]), 'name'));
		}
	}

	if (organization) {
		let rq = referenceQuery('managingOrganization', organization);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'managingOrganization'));
		});
	}

	return boolQuery;
};

/**
 *
 * @param {*} args
 */
module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> search');
	let boolQuery = buildDstu3SearchQuery(args);

	// if (hasRelatedPromises.length > 0) {
	// 	Promise.all(hasRelatedPromises).then((results) => {
	// 		results.forEach((resource) => {
	//
	// 		});
	// 	})
	// } else {
	// 	querySearch(boolQuery, indexName, Patient, Bundle, resolve, reject);
	// }

	querySearch(boolQuery, indexName, args, resolve, reject);
});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> searchById');

	let { base_version, id } = args;

	let Patient = getPatient(base_version);

	searchId(id, indexName, Patient, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Patient = getPatient(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Patient, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Patient = getPatient(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Patient, Meta, resolve, reject, resourceName);
});

module.exports.remove = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> remove');
	let { id } = args;

	_delete(id, indexName, resolve, reject);
});

module.exports.searchByVersionId = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> searchByVersionId');

	let { id, version_id } = args;

	let boolQuery = esb.boolQuery();

	if (id) {
		boolQuery = boolQuery.should(esb.termQuery('_id', id));
	}

	if (version_id) {
		boolQuery = boolQuery.should(esb.termQuery('meta.versionId', version_id));
	}

	querySearch(boolQuery, indexName, args, resolve, reject);
});

module.exports.history = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> history`);

	let boolQuery = buildDstu3SearchQuery(args);

	querySearch(boolQuery, `${indexName}_history`, args, resolve, reject);
});

module.exports.historyById = (args) => new Promise((resolve, reject) => {
	let { base_version, id } = args;

	let Patient = getPatient(base_version);

	searchId(id, `${indexName}_history`, Patient, resolve, reject, resourceName);
});
