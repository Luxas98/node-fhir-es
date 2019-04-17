/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { codeableConceptQueries, identifierQuery, dateQuery, periodQuery} = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirspecimen';
let resourceName = RESOURCES.SPECIMEN;

let getSpecimen = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let accession = args['accession'];
	let bodysite = args['bodysite'];
	let collected = args['collected'];
	let collector = args['collector'];
	let container = args['container'];
	let container_id = args['container-id'];
	let identifier = args['identifier'];
	let parent = args['parent'];
	let patient = args['patient'];
	let status = args['status'];
	let type = args['type'];

	let boolQuery = esb.boolQuery();

	if (accession) {
		let identifierQueries = identifierQuery('accessionIdentifier', accession);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (bodysite) {
		let ccq = codeableConceptQueries('bodySite', bodysite);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (collected) {
		boolQuery = periodQuery(boolQuery, 'collection.collectedPeriod', collected);
		boolQuery = dateQuery(boolQuery, 'collection.collectedDateTime', collected);
	}

	if (collector) {
		boolQuery = boolQuery.should(esb.termQuery('collection.collector', collector));
	}

	if (container) {
		let ccq = codeableConceptQueries('container.type', container);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(esb.nestedQuery(query, 'container.type'), 'container'));
		});
	}

	if (container_id) {
		let identifierQueries = identifierQuery('container.identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(esb.nestedQuery(query, 'container.identifier'), 'container'));
		});
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (parent) {
		let rq = referenceQuery('parent', parent);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'parent'));
		});
	}

	if (patient) {
		let rq = referenceQuery('subject', patient);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status));
	}

	if (type) {
		let ccq = codeableConceptQueries('type', type);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> search`);

	// Common search params
	let { base_version } = args;

	// Resource Specific params
	let subject = args['subject'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

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

	let Specimen = getSpecimen(base_version);

	searchId(id, indexName, Specimen, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Specimen = getSpecimen(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Specimen, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Specimen = getSpecimen(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Specimen, Meta, resolve, reject, resourceName);
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

	let Specimen = getSpecimen(base_version);

	searchId(id, `${indexName}_history`, Specimen, resolve, reject, resourceName);
});
