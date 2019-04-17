/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { codeableConceptQueries, identifierQuery, dateQuery, periodQuery, referenceQuery} = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirprocedurerequest';
let resourceName = RESOURCES.PROCEDUREREQUEST;

let getProcedureRequest = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let authored = args['authored'];
	let based_on = args['based-on'];
	let body_site = args['body-site'];
	let code = args['code'];
	let _context = args['context'];
	let definition = args['definition'];
	let encounter = args['encounter'];
	let identifier = args['identifier'];
	let intent = args['intent'];
	let occurrence = args['occurrence'];
	let patient = args['patient'];
	let performer = args['performer'];
	let performer_type = args['performer-type'];
	let priority = args['priority'];
	let replaces = args['replaces'];
	let requester = args['requester'];
	let requisition = args['requisition'];
	let specimen = args['specimen'];
	let status = args['status'];
	let subject = args['subject'];

	let boolQuery = esb.boolQuery();

	if (authored) {
		boolQuery = dateQuery(boolQuery, 'authoredOn', authored);
	}

	if (based_on) {
		let rq = referenceQuery('basedOn', based_on);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'basedOn'));
		});
	}

	if (body_site) {
		let ccq = codeableConceptQueries('bodySite', body_site);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'bodySite'));
		});
	}

	if (code) {
		let ccq = codeableConceptQueries('code', code);
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

	if (definition) {
		let rq = referenceQuery('definition', definition);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'definition'));
		});
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (intent) {
		boolQuery = boolQuery.should(esb.termQuery('intent', intent));
	}

	if (occurrence) {
		boolQuery = dateQuery(boolQuery, 'occurrenceDateTime', occurrence);
		boolQuery = periodQuery(boolQuery, 'occurrencePeriod', occurrence);
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

	if (performer_type) {
		let ccq = codeableConceptQueries('performerType', performer_type);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (priority) {
		boolQuery = boolQuery.should(esb.termQuery('priority', priority));
	}

	if (replaces) {
		let rq = referenceQuery('replaces', replaces);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'replaces'));
		});
	}

	if (requester) {
		let rq = referenceQuery('requester.agent', requester);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (requisition) {
		let identifierQueries = identifierQuery('requisition', requisition);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (status) {
		boolQuery = boolQuery.boost(esb.termQuery('status', status));
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> search`);

	let { base_version } = args;

	// Resource Specific params
	let encounter = args['encounter'];
	let specimen = args['specimen'];
	let subject = args['subject'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

	if (encounter) {
		const { search: encounterSearch} = require('../encounter/encounter.service');
		referencePromiseSearches.push(encounterSearch({...encounter, base_version: base_version, _rawresource: true}));
	}


	if (specimen) {
		const { search: specimenSearch } = require('../specimen/specimen.service');
		referencePromiseSearches.push(specimenSearch({...subject, base_version: base_version, _rawresource: true}));
	}

	if (subject) {
		const { search: patientSearch } = require('../patient/patient.service');
		referencePromiseSearches.push(patientSearch({...subject, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Patient: 'subject',
		Encounter: 'context',
		Specimen: 'specimen'
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

	let ProcedureRequest = getProcedureRequest(base_version);

	searchId(id, indexName, ProcedureRequest, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let ProcedureRequest = getProcedureRequest(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, ProcedureRequest, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let ProcedureRequest = getProcedureRequest(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, ProcedureRequest, Meta, resolve, reject, resourceName);
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

	let ProcedureRequest = getProcedureRequest(base_version);

	searchId(id, `${indexName}_history`, ProcedureRequest, resolve, reject, resourceName);
});
