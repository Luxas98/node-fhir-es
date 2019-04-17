/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { codeableConceptQueries, rangeQuery, identifierQuery, dateQuery, referenceQuery, numberQuery } = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhircondition';
let resourceName = RESOURCES.CONDITION;

let getCondition = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let abatement_age = args['abatement-age'];
	let abatement_boolean = args['abatement-boolean'];
	let abatement_date = args['abatement-date'];
	let abatement_range = args['abatement-range'];
	let abatement_string = args['abatement-string'];
	let asserted_date = args['asserted-date'];
	let body_site = args['body-site'];
	let category = args['category'];
	let clinical_status = args['clinical-status'];
	let code = args['code'];
	let _context = args['context'];
	let evidence = args['evidence'];
	let evidence_detail = args['evidence-detail'];
	let identifier = args['identifier'];
	let onset_age = args['onset-age'];
	let onset_date = args['onset-date'];
	let onset_range = args['onset-range'];
	let onset_info = args['onset-info'];
	let patient = args['patient'];
	let severity = args['severity'];
	let stage = args['stage'];
	let verification_status = args['verification-status'];

	let boolQuery = esb.boolQuery();

	// Property queries
	if (abatement_age) {
		boolQuery = numberQuery(boolQuery, 'abatementAge.value', abatement_age);
		boolQuery = boolQuery.should(esb.termQuery('abatementAge.code', abatement_age));
	}

	if (abatement_boolean) {
		boolQuery = boolQuery.should(esb.termQuery('abatementBoolean', abatement_boolean));
	}

	if (abatement_date) {
		boolQuery = dateQuery(boolQuery,'abatementDateTime', abatement_date);
	}

	if (abatement_range) {
		boolQuery = rangeQuery(boolQuery, 'abatementRange', abatement_range);
	}

	if (abatement_string) {
		boolQuery = boolQuery.should(esb.termQuery('abatementString', abatement_string));
	}

	if (asserted_date) {
		boolQuery = dateQuery(boolQuery,'assertedDate', asserted_date);
	}

	if (body_site) {
		let ccq = codeableConceptQueries('bodySite', body_site);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'bodySite'));
		});
	}

	if (category) {
		let ccq = codeableConceptQueries('category', category);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'category'));
		});
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

	if (_context) {
		let rq = referenceQuery('context', _context);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (evidence) {
		let ccq = codeableConceptQueries('\'evidence.code', evidence);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(esb.nestedQuery(query, 'evidence.code'), 'evidence'));
		});
	}

	if (evidence_detail) {
		let rq = referenceQuery('evidence.detail', evidence_detail);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(esb.nestedQuery(query,'evidence.detail'), 'evidence'));
		});
	}

	if (onset_age) {
		boolQuery = numberQuery(boolQuery, 'onsetAge.value', onset_age);
		boolQuery = boolQuery.should(esb.termQuery('onsetAge.code', onset_age));
	}

	if (onset_date) {
		boolQuery = dateQuery(boolQuery,'onsetDateTime', onset_date);
	}

	if (onset_range) {
		boolQuery = rangeQuery(boolQuery, 'onsetRange', onset_range);
	}

	if (onset_info) {
		boolQuery = boolQuery.should(esb.termQuery('onsetString', onset_info));
	}

	if (patient) {
		let rq = referenceQuery('subject', patient);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (severity) {
		let ccq = codeableConceptQueries('severity', severity);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (stage) {
		let ccq = codeableConceptQueries('stage.summary', stage);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (verification_status) {
		boolQuery = boolQuery.should(esb.termQuery('verificationStatus', verification_status));
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> search`);


	// Common search params
	let { base_version } = args;


	// Resource Specific params
	let asserter = args['asserter'];
	let _context = args['context'];
	let encounter = args['encounter'];
	let subject = args['subject'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

	if (asserter) {
		const { search: practitionerSearch} = require('../practitioner/practitioner.service');
		referencePromiseSearches.push(practitionerSearch({...asserter, base_version: base_version, _rawresource: true}));
	}

	if (encounter) {
		// Local import, as we are having cycle between condition and encounter
		const { search: encounterSearch } = require('../encounter/encounter.service');
		referencePromiseSearches.push(encounterSearch({..._context, base_version: base_version, _rawresource: true}));
	}

	if (subject) {
		const { search: patientSearch} = require('../patient/patient.service');
		referencePromiseSearches.push(patientSearch({...subject, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Patient: 'subject',
		Encounter: 'context',
		Practitioner: 'asserter'
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

	let Condition = getCondition(base_version);

	searchId(id, indexName, Condition, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Condition = getCondition(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Condition, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Condition = getCondition(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Condition, Meta, resolve, reject, resourceName);
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
	resolve();
});

module.exports.historyById = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> historyBtId`);
	resolve();
});
