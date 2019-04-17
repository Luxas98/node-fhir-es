/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { RESOURCES } = require('../../constants');
const { resolveSchema } = require('../../node-fhir-server');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');
const { codeableConceptQueries, periodQuery, identifierQuery, dateQuery, referenceQuery } = require('../../utils/es.querybuilder.util');

const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirdevicerequest';
let resourceName = RESOURCES.DEVICEREQUEST;

let getBundle = (base_version) => {
	return require(resolveSchema(base_version, 'Bundle'));
};

let getDeviceRequest = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let authored_on = args['authored-on'];
	let based_on = args['based-on'];
	let code = args['code'];
	let definition = args['definition'];
	let event_date = args['event-date'];
	let group_identifier = args['group-identifier'];
	let identifier = args['identifier'];
	let intent = args['intent'];
	let patient = args['patient'];
	let performer = args['performer'];
	let priorrequest = args['priorrequest'];
	let requester = args['requester'];
	let status = args['status'];

	let boolQuery = esb.boolQuery();

	if (authored_on) {
		boolQuery = boolQuery.should(esb.termQuery('authoreOn', authored_on));
	}

	if (based_on) {
		let rq = referenceQuery('basedOn', based_on);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'basedOn'));
		});
	}

	if (code) {
		let ccq = codeableConceptQueries('codeCodeableConcept', code);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (definition) {
		let rq = referenceQuery('definition', definition);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'definition'));
		});
	}

	if (event_date) {
		boolQuery = dateQuery(boolQuery, 'occurrenceDateTime', event_date);
		boolQuery = periodQuery(boolQuery, 'occurrencePeriod', event_date);
	}

	if (group_identifier) {
		let identifierQueries = identifierQuery('groupIdentifier', group_identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (intent) {
		let ccq = codeableConceptQueries('intent', intent);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (patient) {
		let rq = referenceQuery('subject', patient);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (performer) {
		let rq = referenceQuery('performer', performer);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (priorrequest) {
		let rq = referenceQuery('priorRequest', priorrequest);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'priorRequest'));
		});
	}

	if (requester) {
		let rq = referenceQuery('requester.agent', requester);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status));
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> search');

	// Common search params
	let { base_version } = args;
	// Resource Specific params
	let device = args['device'];
	let encounter = args['encounter'];
	let subject = args['subject'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

	if (device) {
		const { search: deviceSearch } = require('../device/device.service');
		referencePromiseSearches.push(deviceSearch({...device, base_version: base_version, _rawresource: true}));
	}

	if (encounter) {
		const { search: encounterSearch } = require('../encounter/encounter.service');
		referencePromiseSearches.push(encounterSearch({...encounter, base_version: base_version, _rawresource: true}));
	}

	if (subject) {
		const { search: patientSearch } = require('../patient/patient.service');
		referencePromiseSearches.push(patientSearch({...subject, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Device: 'codeReference',
		Encounter: 'context'
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

	let DeviceRequest = getDeviceRequest(base_version);

	searchId(id, indexName, DeviceRequest, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let DeviceRequest = getDeviceRequest(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, DeviceRequest, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let DeviceRequest = getDeviceRequest(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, DeviceRequest, Meta, resolve, reject, resourceName);
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

	let DeviceRequest = getDeviceRequest(base_version);

	searchId(id, `${indexName}_history`, DeviceRequest, resolve, reject, resourceName);
});
