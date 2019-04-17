/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { codeableConceptQueries, identifierQuery, referenceQuery } = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirimmunization';
let resourceName = RESOURCES.IMMUNIZATION;

let getImmunization = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};


let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let date = args['date'];
	let dose_sequence = args['dose-sequence'];
	let identifier = args['identifier'];
	let location = args['location'];
	let lot_number = args['lot-number'];
	let manufacturer = args['manufacturer'];
	let notgiven = args['notgiven'];
	let practitioner = args['practitioner'];
	let reaction = args['reaction'];
	let reaction_date = args['reaction-date'];
	let reason = args['reason'];
	let reason_not_given = args['reason-not-given'];
	let status = args['status'];
	let vaccine_code = args['vaccine-code'];

	let boolQuery = esb.boolQuery();

	if (date) {
		boolQuery = boolQuery.should(esb.termQuery('date', date));
	}

	if (dose_sequence) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('vaccinationProtocol.doseSequence', dose_sequence), 'vaccinationProtocol'));
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

	if (lot_number) {
		boolQuery = boolQuery.should(esb.termQuery('lotNumber', lot_number));
	}

	if (manufacturer) {
		let rq = referenceQuery('manufacturer', manufacturer);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (notgiven) {
		boolQuery = boolQuery.should(esb.termQuery('notGiven', notgiven));
	}

	if (practitioner) {
		let rq = referenceQuery('practitioner', practitioner);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'practitioner'));
		});
	}

	if (reaction) {
		// TODO: Maybe this should be search query for reaction reference resource
		let rq = referenceQuery('reaction.detail', reaction);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (reaction_date) {
		boolQuery = boolQuery.should(esb.termQuery('reaction.date', reaction));
	}

	if (reason) {
		let ccq = codeableConceptQueries('explanation.reason', reason);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'explanation.reason'));
		});
	}

	if (reason_not_given) {
		let ccq = codeableConceptQueries('explanation.reasonNotGiven', reason_not_given);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'explanation.reasonNotGiven'));
		});
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status));
	}

	if (vaccine_code) {
		let ccq = codeableConceptQueries('vaccineCode', vaccine_code);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	return boolQuery;
};
/**
 *
 * @param {*} args
 */
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

	let Immunization = getImmunization(base_version);

	searchId(id, indexName, Immunization, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Immunization = getImmunization(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Immunization, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Immunization = getImmunization(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Immunization, Meta, resolve, reject, resourceName);
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

	let Immunization = getImmunization(base_version);

	searchId(id, `${indexName}_history`, Immunization, resolve, reject, resourceName);
});
