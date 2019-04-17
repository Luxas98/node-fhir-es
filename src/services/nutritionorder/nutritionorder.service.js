/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('../../node-fhir-server');
const { identifierQuery, codeableConceptQueries, dateQuery, referenceQuery} = require('../../utils/es.querybuilder.util');
const { search: querySearch, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirnutritionorder';
let resourceName = 'NutritionOrder';

let getNutritionOrder = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag, _has} = args;

	// Resource Specific params
	let additive = args['additive'];
	let datetime = args['datetime'];
	let formula = args['formula'];
	let identifier = args['identifier'];
	let oraldiet = args['oraldiet'];
	let provider = args['provider'];
	let status = args['status'];
	let supplement = args['supplement'];

	let boolQuery = esb.boolQuery();

	if (additive) {
		let ccq = codeableConceptQueries('enteralFormula.additiveType', additive);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (datetime) {
		boolQuery = dateQuery(boolQuery, 'dateTime', datetime);
	}

	if (formula) {
		let ccq = codeableConceptQueries('enteralFormula.baseFormulaType', formula);
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

	if (oraldiet) {
		let ccq = codeableConceptQueries('oralDiet.type', oraldiet);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'oralDiet.type'));
		});
	}

	if (provider) {
		let rq = referenceQuery('orderer', provider);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status));
	}

	if (supplement) {
		let ccq = codeableConceptQueries('supplement.type', method);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'supplement'));
		});

		boolQuery = boolQuery.should(esb.nestedQuery(esb.termsQuery('supplement.productName', supplement), 'supplement'));
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> search');

	// Common search params
	let { base_version } = args;
	// Resource Specific params
	let encounter = args['encounter'];
	let patient = args['patient'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

	if (encounter) {
		const { search: encounterSearch } = require('../encounter/encounter.service');
		referencePromiseSearches.push(encounterSearch({...encounter, base_version: base_version, _rawresource: true}));
	}

	if (patient) {
		const { search: patientSearch } = require('../patient/patient.service');
		referencePromiseSearches.push(patientSearch({...patient, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Patient: 'subject',
		Encounter: 'encounter'
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

	let NutritionOrder = getNutritionOrder(base_version);

	searchId(id, indexName, NutritionOrder, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let NutritionOrder = getNutritionOrder(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, NutritionOrder, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let NutritionOrder = getNutritionOrder(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, NutritionOrder, Meta, resolve, reject, resourceName);
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
		boolQuery = boolQuery.should(esb.termQuery('_id', id))
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

	let NutritionOrder = getNutritionOrder(base_version);

	searchId(id, `${indexName}_history`, NutritionOrder, resolve, reject, resourceName);
});
