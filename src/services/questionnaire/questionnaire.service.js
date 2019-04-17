/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('../../node-fhir-server');
const { identifierQuery, periodQuery, codeableConceptQueries } = require('../../utils/es.querybuilder.util');
const { search: querySearch, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirquestionnaire';
let resourceName = 'Questionnaire';

let getQuestionnaire = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag, _has} = args;

	// Resource Specific params
	let code = args['code'];
	let date = args['date'];
	let description = args['description'];
	let effective = args['effective'];
	let identifier = args['identifier'];
	let jurisdiction = args['jurisdiction'];
	let name = args['name'];
	let publisher = args['publisher'];
	let status = args['status'];
	let title = args['title'];
	let url = args['url'];
	let version = args['version'];

	let boolQuery = esb.boolQuery();

	if (code) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('code.code', code), 'code'));
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('code.display', code), 'code'));
	}

	if (date) {
		boolQuery = boolQuery.should(esb.termQuery('date', date));
	}

	if (description) {
		boolQuery = boolQuery.should(esb.termQuery('description', description));
	}

	if (effective) {
		boolQuery = periodQuery(boolQuery, 'effectivePeriod', effective);
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (jurisdiction) {
		let ccq = codeableConceptQueries('jurisdiction', jurisdiction);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'jurisdiction'));
		});
	}

	if (name) {
		boolQuery = boolQuery.should(esb.termQuery('name', name));
	}

	if (publisher) {
		boolQuery = boolQuery.should(esb.termQuery('publisher', publisher));
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status));
	}

	if (title) {
		boolQuery = boolQuery.should(esb.termQuery('title', title));
	}

	if (url) {
		boolQuery = boolQuery.should(esb.termQuery('url', url));
	}

	if (version) {
		boolQuery = boolQuery.should(esb.termQuery('version', version));
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> everything');

	let boolQuery = buildDstu3SearchQuery(args);

	querySearch(boolQuery, indexName, args, resolve, reject);
});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> searchById');

	let { base_version, id } = args;

	let Questionnaire = getQuestionnaire(base_version);

	searchId(id, indexName, Questionnaire, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Questionnaire = getQuestionnaire(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Questionnaire, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Questionnaire = getQuestionnaire(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Questionnaire, Meta, resolve, reject, resourceName);
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

	let Questionnaire = getQuestionnaire(base_version);

	searchId(id, `${indexName}_history`, Questionnaire, resolve, reject, resourceName);
});

