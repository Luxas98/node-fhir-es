/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { RESOURCES } = require('../../constants');
const { resolveSchema } = require('../../node-fhir-server');
const { codeableConceptQueries, periodQuery, quantityQuery, referenceQuery, dateQuery } = require('../../utils/es.querybuilder.util');

const { search: patientSearch } = require('../patient/patient.service');
const { search: encounterSearch } = require('../encounter/encounter.service');
const logger = require('../../node-fhir-server').loggers.get();

const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');


let indexName = 'fhirobservation';
let resourceName = RESOURCES.OBSERVATION;


let getObservation = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let based_on = args['based-on'];
	let category = args['category'];
	let code = args['code'];
	let _context = args['context'];
	let data_absent_reason = args['data-absent-reason'];
	let device = args['device'];
	let identifier = args['identifier'];
	let method = args['method'];
	let patient = args['patient'];
	let performer = args['performer'];
	let specimen = args['specimen'];
	let status = args['status'];
	let reference = args['reference'];
	let value_concept = args['value-concept'];
	let value_date = args['value-date'];
	let value_quantity = args['value-quantity'];
	let value_string = args['value-string'];

	let boolQuery = esb.boolQuery();

	if (based_on) {
		let rq = referenceQuery('basedOn', based_on);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'basedOn'));
		});
	}

	if (category) {
		let ccq = codeableConceptQueries('category', category);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'category'));
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
			boolQuery = boolQuery.should(query);
		});
	}

	if (data_absent_reason) {
		let ccq = codeableConceptQueries('dataAbsentReason', data_absent_reason);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (value_concept) {
		let ccq = codeableConceptQueries('valueCodeableConcept', value_concept);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (value_date) {
		boolQuery = periodQuery(boolQuery, 'valuePeriod', value_date);
		boolQuery = dateQuery(boolQuery , 'valueDateTime', value_date);
	}

	if (device) {
		boolQuery = boolQuery.should(esb.matchQuery('device', device));
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (method) {
		let ccq = codeableConceptQueries('method', method);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (patient) {
		const { referenceQuery } = require('../../utils/es.querybuilder.util');
		let rq = referenceQuery('subject', patient);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (performer) {
		let rq = referenceQuery('performer', performer);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'performer'));
		});
	}

	if (specimen) {
		let rq = referenceQuery('specimen', specimen);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status));
	}

	if (reference) {
		let rq = referenceQuery('basedOn', based_on);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'basedOn'));
		});
	}

	if (value_quantity) {
		boolQuery = quantityQuery(boolQuery, 'valueQuantity', value_quantity);
	}

	if (value_string) {
		boolQuery = boolQuery.should(esb.termQuery('valueString', value_string));
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> search`);

	// Common search params
	let { base_version } = args;
	// Resource Specific params
	let encounter = args['encounter'];
	let subject = args['subject'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

	if (encounter) {
		referencePromiseSearches.push(encounterSearch({...encounter, base_version: base_version, _rawresource: true}));
	}

	if (subject) {
		referencePromiseSearches.push(patientSearch({...subject, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Patient: 'subject',
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

	let Observation = getObservation(base_version);

	searchId(id, indexName, Observation, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Observation = getObservation(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Observation, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Observation = getObservation(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Observation, Meta, resolve, reject, resourceName);
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

	let Observation = getObservation(base_version);

	searchId(id, `${indexName}_history`, Observation, resolve, reject, resourceName);
});
