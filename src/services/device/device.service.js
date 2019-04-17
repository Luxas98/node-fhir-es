/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { codeableConceptQueries, identifierQuery, referenceQuery} = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirdevice';
let resourceName = RESOURCES.DEVICE;

let getDevice = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	let device_name = args['device-name'];
	let identifier = args['identifier'];
	let location = args['location'];
	let manufacturer = args['manufacturer'];
	let model = args['model'];
	let organization = args['organization'];
	let status = args['status'];
	let type = args['type'];
	let udi_carrier = args['udi-carrier'];
	let udi_di = args['udi-di'];
	let url = args['url'];

	let boolQuery = esb.boolQuery();

	if (device_name) {
		let ccq = codeableConceptQueries('type', device_name);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (location) {
		let rq = referenceQuery('location', location);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (manufacturer) {
		boolQuery = boolQuery.should(esb.termQuery('manufacturer', manufacturer));
	}

	if (model) {
		boolQuery = boolQuery.should(esb.termQuery('model', model));
	}

	if (organization) {
		let rq = referenceQuery('owner', organization);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status));
	}

	if (type) {
		let ccq = codeableConceptQueries('type', type);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (udi_carrier) {
		boolQuery = boolQuery.should(esb.termQuery('udi.carrierHRF', udi_carrier));
		boolQuery = boolQuery.should(esb.termQuery('udi.carrierAIDC', udi_carrier));
	}

	if (udi_di) {
		boolQuery = boolQuery.should(esb.termQuery('udi.deviceIdentifier', udi_di));
	}

	if (url) {
		boolQuery = boolQuery.should(esb.termQuery('url', url));
	}

	return boolQuery;
};


module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> search`);
	// Common search params
	let { base_version } = args;
	// Resource Specific params
	let patient = args['patient'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

	if (patient) {
		const { search: patientSearch } = require('../patient/patient.service');
		referencePromiseSearches.push(patientSearch({...patient, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Patient: 'patient'
	};

	if (referencePromiseSearches.length > 0) {
		searchReferenecePromise(referencePromiseSearches, referenceResultMapping, boolQuery, indexName, resolve, reject);
	} else {
		querySearch(boolQuery, indexName, args, resolve, reject);
	}
});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> searchById');

	let { base_version, id } = args;

	let Device = getDevice(base_version);

	searchId(id, indexName, Device, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Device = getDevice(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Device, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Device = getDevice(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Device, Meta, resolve, reject, resourceName);
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

	let Device = getDevice(base_version);

	searchId(id, `${indexName}_history`, Device, resolve, reject, resourceName);
});
