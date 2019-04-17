/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('../../node-fhir-server');
const { RESOURCES } = require('../../constants');
const { codeableConceptQueries, identifierQuery, referenceQuery } = require('../../utils/es.querybuilder.util');
const { search: querySearch, searchId, create, _delete, update, } = require('../../utils/es.helper.functions.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirallergyintolerance';
let resourceName = RESOURCES.ALLERGYINTOLERANCE;

let getAllergyIntolerance = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// AllergyIntolerance search params
	let asserter = args['asserter'];
	let category = args['category'];
	let clinical_status = args['clinical-status'];
	let code = args['code'];
	let criticality = args['criticality'];
	let date = args['date'];
	let identifier = args['identifier'];
	let last_date = args['last-date'];
	let manifestation = args['manifestation'];
	let onset = args['onset'];
	let patient = args['patient'];
	let recorder = args['recorder'];
	let route = args['route'];
	let severity = args['severity'];
	let type = args['type'];
	let verification_status = args['verification-status'];

	let boolQuery = esb.boolQuery();

	if (asserter) {
		boolQuery = boolQuery.should(esb.termQuery('asserter', asserter));
	}

	if (category) {
		boolQuery = boolQuery.should(esb.termQuery('category', category));
	}

	if (clinical_status) {
		boolQuery = boolQuery.should(esb.termQuery('clinicalStatus', clinical_status));
	}

	if (code) {
		let ccq = codeableConceptQueries('code', code);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (criticality) {
		boolQuery = boolQuery.should(esb.termQuery('criticality', criticality));
	}

	if (date) {
		boolQuery = boolQuery.should(esb.termQuery('assertedDate', date));
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (last_date) {
		boolQuery = boolQuery.should(esb.termQuery('lastOccurrence', last_date));
	}

	if (manifestation) {
		let ccq = codeableConceptQueries('reaction.manifestation', category);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(esb.nestedQuery(query, 'reaction.manifestation'), 'reaction'));
		});
	}

	if (onset) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('reaction.onset', onset), 'reaction'));
	}

	if (patient) {
		let rq = referenceQuery('patient', patient);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (recorder) {
		boolQuery = boolQuery.should(esb.termQuery('recorder', recorder));
	}

	if (route) {
		let ccq = codeableConceptQueries('reaction.exposureRoute', category);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'reaction'));
		});
	}

	if (severity) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('reaction.severity', severity), 'reaction'));
	}

	if (type) {
		boolQuery = boolQuery.should(esb.termQuery('type', type));
	}

	if (verification_status) {
		boolQuery = boolQuery.should(esb.termQuery('verificationStatus', verification_status));
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

	querySearch(boolQuery, indexName, args, resolve, reject);

});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> searchById');

	let { base_version, id } = args;

	let AllergyIntolerance = getAllergyIntolerance(base_version);

	searchId(id, indexName, AllergyIntolerance, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let AllergyIntolerance = getAllergyIntolerance(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, AllergyIntolerance, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let AllergyIntolerance = getAllergyIntolerance(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, AllergyIntolerance, Meta, resolve, reject, resourceName);
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

	let AllergyIntolerance = getAllergyIntolerance(base_version);

	searchId(id, `${indexName}_history`, AllergyIntolerance, resolve, reject, resourceName);
});
