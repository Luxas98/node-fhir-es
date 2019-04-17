/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('../../node-fhir-server');
const { identifierQuery, periodQuery, codeableConceptQueries, dateQuery, referenceQuery} = require('../../utils/es.querybuilder.util');
const { search: querySearch, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirconsent';
let resourceName = 'Consent';

let getConsent = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag, _has} = args;

	// Resource Specific params
	let action = args['action'];
	let actor = args['actor'];
	let category = args['category'];
	let consentor = args['consentor'];
	let data = args['data'];
	let date = args['date'];
	let identifier = args['identifier'];
	let organization = args['organization'];
	let period = args['period'];
	let purpose = args['purpose'];
	let securitylabel = args['securitylabel'];
	let source = args['source'];
	let status = args['status'];

	let boolQuery = esb.boolQuery();

	if (actor) {
		let ccq = codeableConceptQueries('actor.role', actor);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});

		let rq = referenceQuery('actor', actor);
		rq.forEach((query) => {
			boolQuery.should(query)
		});
	}

	if (action) {
		let ccq = codeableConceptQueries('action', action);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'action'));
		});
	}

	if (category) {
		let ccq = codeableConceptQueries('category', category);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'category'));
		});
	}

	if (consentor) {
		let rq = referenceQuery('consentingParty', consentor);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'consentingParty'));
		});
	}

	if (data) {
		let rq = referenceQuery('data', data);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (date) {
		boolQuery = dateQuery(boolQuery, 'dateTime', date);
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (organization) {
		let rq = referenceQuery('organization', organization);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'organization'));
		});
	}

	if (period) {
		boolQuery = periodQuery(boolQuery, 'period', period);
	}

	if (purpose) {
		// TODO: does this should be code query??
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('purpose.code', purpose), 'purpose'));
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('purpose.display', purpose), 'purpose'));
	}

	if (securitylabel) {
		// TODO: does this should be code query??
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('securityLabel.code', purpose), 'securityLabel'));
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('securityLabel.display', purpose), 'securityLabel'));
	}

	if (source) {
		let rq = referenceQuery('sourceReference', source);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status));
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> search');

	// Common search params
	let { base_version } = args;

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

	let Consent = getConsent(base_version);

	searchId(id, indexName, Consent, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Consent = getConsent(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Consent, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Consent = getConsent(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Consent, Meta, resolve, reject, resourceName);
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

	let Consent = getConsent(base_version);

	searchId(id, `${indexName}_history`, Consent, resolve, reject, resourceName);
});
