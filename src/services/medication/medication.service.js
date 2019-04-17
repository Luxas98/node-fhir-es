/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { codeableConceptQueries, referenceQuery } = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirmedication';
let resourceName = RESOURCES.MEDICATION;

let getMedication = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

// Resource Specific params
	let code = args['code'];
	let container = args['container'];
	let form = args['form'];
	let ingredient = args['ingredient'];
	let ingredient_code = args['ingredient-code'];
	let manufacturer = args['manufacturer'];
	let over_the_counter = args['over-the-counter'];
	let package_item = args['package-item'];
	let package_item_code = args['package-item-code'];
	let status = args['status'];

	let boolQuery = esb.boolQuery();

	if (code) {
		let ccq = codeableConceptQueries('code', code);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (container) {
		let ccq = codeableConceptQueries('package.container', container);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (form) {
		let ccq = codeableConceptQueries('form', form);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (ingredient) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('ingredient.itemReference', ingredient), 'ingredient'));
	}

	if (ingredient_code) {
		let ccq = codeableConceptQueries('ingredient.itemCodeableConcept', ingredient_code);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'ingredient'));
		});
	}

	if (manufacturer) {
		let rq = referenceQuery('manufacturer', manufacturer);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (over_the_counter) {
		boolQuery = boolQuery.should(esb.termQuery('isOverTheCounter', over_the_counter));
	}

	if (package_item) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('package.content.itemReference', package_item), 'package.content'));
	}

	if (package_item_code) {
		let ccq = codeableConceptQueries('package.content.itemCodeableConcept', package_item_code);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'package.content'));
		});
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status));
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> search`);

	let boolQuery = buildDstu3SearchQuery(args);

	querySearch(boolQuery, indexName, args, resolve, reject);

});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> searchById');

	let { base_version, id } = args;

	let Medication = getMedication(base_version);

	searchId(id, indexName, Medication, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Medication = getMedication(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Medication, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Medication = getMedication(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Medication, Meta, resolve, reject, resourceName);
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

	let Medication = getMedication(base_version);

	searchId(id, `${indexName}_history`, Medication, resolve, reject, resourceName);
});
