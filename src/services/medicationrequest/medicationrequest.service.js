/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { codeableConceptQueries, identifierQuery, referenceQuery } = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirmedicationrequest';
let resourceName = RESOURCES.MEDICATIONREQUEST;

let getMedicationRequest = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag, _has} = args;

	// Resource Specific params
	let authoredon = args['authoredon'];
	let category = args['category'];
	let code = args['code'];
	let _context = args['context'];
	let date = args['date'];
	let identifier = args['identifier'];
	let intended_dispenser = args['intended-dispenser'];
	let intent = args['intent'];
	let medication = args['medication'];
	let patient = args['patient'];
	let priority = args['priority'];
	let requester = args['requester'];
	let status = args['status'];

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

	if (authoredon) {
		boolQuery = boolQuery.should(esb.termQuery('authoredOn', authoredon));
	}

	if (category) {
		let ccq = codeableConceptQueries('category', category);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (code) {
		let ccq = codeableConceptQueries('medicationCodeableConcept', code);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (_context) {
		let rq = referenceQuery('context', _context);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (date) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('dosageInstruction.timing.event', date), 'dosageInstruction'));
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (intended_dispenser) {
		boolQuery = boolQuery.should(esb.termQuery('dispenseRequest.performer', intended_dispenser));
	}

	if (intent) {
		boolQuery = boolQuery.should(esb.termQuery('intent', intent));
	}

	if (medication) {
		let rq = referenceQuery('medicationReference', medication);
		rq.forEach((query) => {
			boolQuery.should(query)
		});
	}

	if (patient) {
		let rq = referenceQuery('subject', medication);
		rq.forEach((query) => {
			boolQuery.should(query)
		});
	}

	if (priority) {
		boolQuery = boolQuery.should(esb.termQuery('priority', priority));
	}

	if (requester) {
		let rq = referenceQuery('requester.agent', requester);
		rq.forEach((query) => {
			boolQuery.should(query)
		});
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status))
	}

	return boolQuery
};


/**
 *
 * @param {*} args
 */
module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> search`);

	// Common search params
	let { base_version } = args;
	let subject = args['subject'];

	let referencePromiseSearches = [];
	let boolQuery = buildDstu3SearchQuery(args);


	if (subject) {
		const { search: patientSearch } = require('../patient/patient.service');
		referencePromiseSearches.push(patientSearch({...subject, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Patient: 'subject'
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

	let MedicationRequest = getMedicationRequest(base_version);

	searchId(id, indexName, MedicationRequest, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let MedicationRequest = getMedicationRequest(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, MedicationRequest, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let MedicationRequest = getMedicationRequest(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, MedicationRequest, Meta, resolve, reject, resourceName);
});

module.exports.remove = (args, context, logger) => new Promise((resolve, reject) => {
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

	let MedicationRequest = getMedicationRequest(base_version);

	searchId(id, `${indexName}_history`, MedicationRequest, resolve, reject, resourceName);
});
