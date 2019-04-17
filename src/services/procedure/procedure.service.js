/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { RESOURCES } = require('../../constants');
const { resolveSchema } = require('../../node-fhir-server');
const { codeableConceptQueries, periodQuery, identifierQuery, dateQuery, referenceQuery} = require('../../utils/es.querybuilder.util');
const { search: patientSearch } = require('../patient/patient.service');
const { search: observationSearch } = require('../observation/observation.service');
const { search: medicationAdministrationSearch } = require('../medicationadministration/medicationadministration.service');
const logger = require('../../node-fhir-server').loggers.get();

const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');


let indexName = 'fhirprocedure';
let resourceName = RESOURCES.PROCEDURE;

let getProcedure = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let based_on = args['based-on'];
	let body_site = args['body-site'];
	let category = args['category'];

	let code = args['code'];
	let complication = args['complication'];
	let complication_detail = args['complication-detail'];
	let _context = args['context'];
	let date = args['date'];
	let definition = args['definition'];
	let identifier = args['identifier'];
	let location = args['location'];
	let not_done = args['not-done'];
	let not_done_reason = args['not-done-reason'];
	let note = args['note'];
	let outcome = args['outcome'];
	let patient = args['patient'];
	let performer = args['performer'];
	let report = args['report'];
	let status = args['status'];

	let boolQuery = esb.boolQuery();

	if (_context) {
		let rq = referenceQuery('context', _context);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (based_on) {
		let rq = referenceQuery('basedOn', based_on);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'basedOn'));
		});
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
			boolQuery = boolQuery.should(query);
		});
	}

	if (code) {
		let ccq = codeableConceptQueries('code', code);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (complication) {
		let ccq = codeableConceptQueries('complication', complication);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'complication'));
		});
	}

	if (complication_detail) {
		boolQuery = boolQuery.should(esb.termQuery('complicationDetail', complication_detail));
	}

	if (date) {
		boolQuery = dateQuery(boolQuery, 'performedDateTime', date);
		boolQuery = periodQuery(boolQuery, 'performedPeriod', date);
	}

	if (definition) {
		let rq = referenceQuery('definition', definition);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'definition'));
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
			boolQuery.should(query);
		});
	}

	if (not_done) {
		boolQuery = boolQuery.should(esb.termQuery('notDone', not_done));
	}

	if (not_done_reason) {
		let ccq = codeableConceptQueries('notDoneReason', not_done_reason);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (note) {
		// TODO: not yet implemented
		boolQuery = annotationQuery(boolQuery, 'note', note);
	}

	if (outcome) {
		let ccq = codeableConceptQueries('outcome', outcome);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (patient) {
		const { referenceQuery } = require('../../utils/es.querybuilder.util');
		let rq = referenceQuery('subject', patient);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (performer) {
		let rq = referenceQuery('performer.actor', performer);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'performer'));
		});

		let ccq = codeableConceptQueries('performer', performer);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'performer'));
		});
	}

	if (report) {
		let ccq = codeableConceptQueries('report', report);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'report'));
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
	let encounter = args['encounter'];
	let part_of = args['part-of'];
	let subject = args['subject'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];



	if (encounter) {
		// Local import because of cyclic imports
		const { search: encounterSearch} = require('../encounter/encounter.service');
		referencePromiseSearches.push(encounterSearch({...encounter, base_version: base_version, _rawresource: true}));
	}

	if (part_of) {
		referencePromiseSearches.push(observationSearch({...part_of, base_version: base_version,_rawresource: true}));
		referencePromiseSearches.push(this.search({...part_of, base_version: base_version,_rawresource: true}));
		referencePromiseSearches.push(medicationAdministrationSearch({...part_of, base_version: base_version,_rawresource: true}));
	}

	if (subject) {
		referencePromiseSearches.push(patientSearch({...subject, base_version: base_version,_rawresource: true}));
	}

	let referenceResultMapping = {
		Patient: 'subject',
		Encounter: 'context',
		Observation: 'partOf',
		Procedure: 'partOf',
		MedicationAdministration: 'partOf'
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

	let Procedure = getProcedure(base_version);

	searchId(id, indexName, Procedure, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Procedure = getProcedure(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Procedure, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Procedure = getProcedure(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Procedure, Meta, resolve, reject, resourceName);
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

	let Procedure = getProcedure(base_version);

	searchId(id, `${indexName}_history`, Procedure, resolve, reject, resourceName);
});
