/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { periodQuery, codeableConceptQueries, identifierQuery, referenceQuery} = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirpractitionerrole';
let resourceName = RESOURCES.PRACTITIONERROLE;

let getPractitionerRole = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let active = args['active'];
	let date = args['date'];
	let email = args['email'];
	let endpoint = args['endpoint'];
	let identifier = args['identifier'];
	let location = args['location'];
	let organization = args['organization'];
	let phone = args['phone'];
	let role = args['role'];
	let service = args['service'];
	let specialty = args['specialty'];
	let telecom = args['telecom'];

	let boolQuery = esb.boolQuery();

	if (active) {
		boolQuery = boolQuery.should(esb.termQuery('active', active));
	}

	if (date) {
		boolQuery = periodQuery(boolQuery, 'period', date);
	}

	if (email) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('telecom.system', 'email'), 'telecom'));
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('telecom.value', email), 'telecom'));
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

	if (location) {
		let rq = referenceQuery('location', location);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'location'));
		});
	}

	if (organization) {
		boolQuery = boolQuery.should(esb.termsQuery('organization', organization));
	}

	if (phone) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('telecom.system', 'phone'), 'telecom'));
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('telecom.value', phone), 'telecom'));
	}

	if (role) {
		let ccq = codeableConceptQueries('code', role);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'code'));
		});
	}

	if (service) {
		let rq = referenceQuery('healthcareService', service);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'healthcareService'));
		});
	}

	if (specialty) {
		let ccq = codeableConceptQueries('specialty', specialty);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'specialty'));
		});
	}

	if (telecom) {
		// TODO: make a telecom query
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
	let practitioner = args['practitioner'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

	if (practitioner) {
		const { search: practitionerSearch} = require('../practitioner/practitioner.service');
		referencePromiseSearches.push(practitionerSearch({...practitioner, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Practitioner: 'practitioner'
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

	let PractitionerRole = getPractitionerRole(base_version);

	searchId(id, indexName, PractitionerRole, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let PractitionerRole = getPractitionerRole(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, PractitionerRole, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let PractitionerRole = getPractitionerRole(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, PractitionerRole, Meta, resolve, reject, resourceName);
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

	let PractitionerRole = getPractitionerRole(base_version);

	searchId(id, `${indexName}_history`, PractitionerRole, resolve, reject, resourceName);
});
