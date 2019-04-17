/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { addressQuery, codeableConceptQueries, identifierQuery, referenceQuery } = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirorganization';
let resourceName = RESOURCES.ORGANIZATION;

let getOrganization = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	let active = args['active'];
	let address = args['address'];
	let address_city = args['address-city'];
	let address_country = args['address-country'];
	let address_postalcode = args['address-postalcode'];
	let address_state = args['address-state'];
	let address_use = args['address-use'];
	let endpoint = args['endpoint'];
	let identifier = args['identifier'];
	let name = args['name'];
	let partof = args['partof'];
	let phonetic = args['phonetic'];
	let type = args['type'];

	let boolQuery = esb.boolQuery();

	if (active) {
		boolQuery = boolQuery.should(esb.termQuery('active', active));
	}

	if (address) {
		boolQuery = addressQuery(boolQuery, 'address', address);
	}

	if (address_city) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('address.city', address_city), 'address'));
	}

	if (address_country) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('address.country', address_country), 'address'));
	}

	if (address_postalcode) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('address.postalCode', address_postalcode), 'address'));
	}

	if (address_state) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('address.state', address_state), 'address'));
	}

	if (address_use) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('address.use', address_use), 'address'));
	}

	if (endpoint) {
		let rq = referenceQuery('endpoint', endpoint);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'endpoint'));
		});
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (name) {
		boolQuery = boolQuery.should(esb.termQuery('name', name));
	}

	if (partof) {
		let rq = referenceQuery('partOf', partof);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (phonetic) {
		boolQuery = boolQuery.should(esb.termQuery('name', name));
	}

	if (type) {
		let ccq = codeableConceptQueries('type', type);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}
};

/**
 *
 * @param {*} args
 */
module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> search`);

	let boolQuery = buildDstu3SearchQuery(args);

	querySearch(boolQuery, indexName, args, resolve, reject);
});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> searchById');

	let { base_version, id } = args;

	let Organization = getOrganization(base_version);

	searchId(id, indexName, Organization, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Organization = getOrganization(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Organization, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Organization = getOrganization(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Organization, Meta, resolve, reject, resourceName);
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

	let Organization = getOrganization(base_version);

	searchId(id, `${indexName}_history`, Organization, resolve, reject, resourceName);
});
