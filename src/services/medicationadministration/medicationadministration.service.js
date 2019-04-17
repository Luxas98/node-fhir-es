/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { RESOURCES } = require('../../constants');
const { resolveSchema } = require('../../node-fhir-server');
const { codeableConceptQueries, periodQuery, identifierQuery, dateQuery, referenceQuery} = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

let indexName = 'fhirmedicationadministration';
let resourceName = RESOURCES.MEDICATIONADMINISTRATION;

let getMedicationAdministration = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	let code = args['code'];
	let _context = args['context'];
	let device = args['device'];
	let effective_time = args['effective-time'];
	let identifier = args['identifier'];
	let medication = args['medication'];
	let not_given = args['not-given'];
	let patient = args['patient'];
	let performer = args['performer'];
	let prescription = args['prescription'];
	let reason_given = args['reason-given'];
	let reason_not_given = args['reason-not-given'];
	let status = args['status'];


	let boolQuery = esb.boolQuery();

	if (_context) {
		let rq = referenceQuery('context', _context);

		rq.forEach((query) => {
			boolQuery.should(query)
		});
	}

	if (code) {
		let ccq = codeableConceptQueries('medicationCodeableConcept', code);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (device) {
		let rq = referenceQuery('device', device);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'device'));
		});
	}

	if (effective_time) {
		boolQuery = dateQuery(boolQuery, 'effectiveDateTime', effective_time);
		boolQuery = periodQuery(boolQuery, 'effectivePeriod', effective_time);
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (medication) {
		// TODO: change this to search query when we have medication objects
		let rq = referenceQuery('medicationReference',  medication);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (not_given) {
		boolQuery = boolQuery.should(esb.termQuery('notGive', not_given));
	}

	if (patient) {
		const { referenceQuery } = require('../../utils/es.querybuilder.util');
		let rq = referenceQuery('subject',  patient);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (performer) {
		let rq = referenceQuery('performer.actor',  performer);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'performer'));
		});

		let ccq = codeableConceptQueries('performer', performer);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'performer'));
		});
	}

	if (prescription) {
		// TODO: search in MedicationRequest??
		let rq = referenceQuery('prescription',  prescription);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (reason_given) {
		let ccq = codeableConceptQueries('reasonCode', reason_given);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'reasonCode'));
		});
	}

	if (reason_not_given) {
		let ccq = codeableConceptQueries('reasonNotGiven', reason_not_given);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'reasonNotGiven'));
		});
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status));
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> search`);
	let { base_version } = args;
	// Resource Specific params
	let reason_reference = args['reason-reference'];
	let subject = args['subject'];
	let encounter = args['encounter'];
	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

	if (encounter) {
		const { search: encounterSearch} = require('../encounter/encounter.service');
		referencePromiseSearches.push(encounterSearch({...encounter, base_version: base_version, _rawresource: true}));
	}

	if (subject) {
		const { search: patientSearch} = require('../patient/patient.service');
		referencePromiseSearches.push(patientSearch({...subject, base_version: base_version, _rawresource: true}));
	}

	if (reason_reference) {
		const { search: observationSearch} = require('../observation/observation.service');
		const { search: conditionSearch} = require('../condition/condition.service');
		referencePromiseSearches.push(observationSearch({...reason_reference, base_version: base_version, _rawresource: true}));
		referencePromiseSearches.push(conditionSearch({...reason_reference, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Patient: 'subject',
		Encounter: 'context'
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

	let MedicationAdministration = getMedicationAdministration(base_version);

	searchId(id, indexName, MedicationAdministration, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let MedicationAdministration = getMedicationAdministration(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, MedicationAdministration, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let MedicationAdministration = getMedicationAdministration(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, MedicationAdministration, Meta, resolve, reject, resourceName)
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

	let MedicationAdministration = getMedicationAdministration(base_version);

	searchId(id, `${indexName}_history`, MedicationAdministration, resolve, reject, resourceName);
});
