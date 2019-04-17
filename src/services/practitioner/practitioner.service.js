/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { addressQuery, codeableConceptQueries, identifierQuery} = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirpractitioner';
let resourceName = RESOURCES.PRACTITIONER;

let getPractitioner = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let active = args['active'];
	let address = args['address'];
	let address_city = args['address-city'];
	let address_country = args['address-country'];
	let address_postalcode = args['address-postalcode'];
	let address_state = args['address-state'];
	let address_use = args['address-use'];
	let communication = args['communication'];
	let email = args['email'];
	let family = args['family'];
	let gender = args['gender'];
	let given = args['given'];
	let identifier = args['identifier'];
	let name = args['name'];
	let phone = args['phone'];
	let phonetic = args['phonetic'];

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

	if (communication) {
		let ccq = codeableConceptQueries('communication', communication);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'communication'));
		});
	}

	if (email) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('telecom.system', 'email'), 'telecom'));
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('telecom.value', email), 'telecom'));
	}

	if (family) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.family', family), 'name'));
	}

	if (gender) {
		boolQuery = boolQuery.should(esb.termQuery('gender', gender));
	}

	if (given) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.given', given), 'name'));
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (name) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.family', name), 'name'));
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.given', name), 'name'));
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.prefix', name), 'name'));
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.text', name), 'name'));
	}

	if (phone) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('telecom.system', 'phone'), 'telecom'));
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('telecom.value', phone), 'telecom'));
	}

	if (phonetic) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.family', phonetic), 'name'));
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('name.given', phonetic), 'name'));
	}

	return boolQuery;
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

	let Practitioner = getPractitioner(base_version);

	searchId(id, indexName, Practitioner, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Practitioner = getPractitioner(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Practitioner, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Practitioner = getPractitioner(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Practitioner, Meta, resolve, reject, resourceName);
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

	let Practitioner = getPractitioner(base_version);

	searchId(id, `${indexName}_history`, Practitioner, resolve, reject, resourceName);
});
