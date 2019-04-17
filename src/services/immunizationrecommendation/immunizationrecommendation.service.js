/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { identifierQuery } = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirimmunizationrecommendation';
let resourceName = RESOURCES.IMMUNIZATIONRECOMMENDATION;

let getImmunizationRecommendation = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let date = args['date'];
	let dose_number = args['dose-number'];
	let dose_sequence = args['dose-sequence'];
	let identifier = args['identifier'];
	let information = args['information'];
	let status = args['status'];
	let support = args['support'];
	let target_disease = args['target-disease'];
	let vaccine_type = args['vaccine-type'];

	let boolQuery = esb.boolQuery();

	if (date) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('recommendation.date', date), 'recommendation'));
	}

	if (dose_number) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('recommendation.doseNumber', dose_number), 'recommendation'));
	}

	if (dose_sequence) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('recommendation.protocol.doseSequence', dose_sequence), 'recommendation'));
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (information) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('recommendation.supportingPatientInformation', information), 'recommendation'));
	}

	if (status) {
		let ccq = codeableConceptQueries('recommendation.forecastStatus', status);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query,'recommendation'));
		});
	}

	if (support) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('recommendation.supportingImmunization', information), 'recommendation'));
	}

	if (target_disease) {
		let ccq = codeableConceptQueries('recommendation.targetDisease', target_disease);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query,'recommendation'));
		});
	}

	if (vaccine_type) {
		let ccq = codeableConceptQueries('recommendation.vaccineCode', vaccine_type);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query,'recommendation'));
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

	let ImmunizationRecommendation = getImmunizationRecommendation(base_version);

	searchId(id, indexName, ImmunizationRecommendation, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let ImmunizationRecommendation = getImmunizationRecommendation(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, ImmunizationRecommendation, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let ImmunizationRecommendation = getImmunizationRecommendation(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, ImmunizationRecommendation, Meta, resolve, reject, resourceName);
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

	let ImmunizationRecommendation = getImmunizationRecommendation(base_version);

	searchId(id, `${indexName}_history`, ImmunizationRecommendation, resolve, reject, resourceName);
});
