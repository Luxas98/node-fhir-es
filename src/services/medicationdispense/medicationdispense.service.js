/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { codeableConceptQueries, identifierQuery, referenceQuery } = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirmedicationdispense';
let resourceName = RESOURCES.MEDICATIONDISPENSE;

let getMedicationDispense = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {

	let code = args['code'];
	let _context = args['context'];
	let destination = args['destination'];
	let identifier = args['identifier'];
	let patient = args['patient'];
	let performer = args['performer'];
	let prescription = args['prescription'];
	let receiver = args['receiver'];
	let responsibleparty = args['responsibleparty'];
	let status = args['status'];
	let type = args['type'];
	let whenhandedover = args['whenhandedover'];
	let whenprepared = args['whenprepared'];

	let boolQuery = esb.boolQuery();

	if (code) {
		let ccq = codeableConceptQueries('medicationCodeableConcept', code);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (_context) {
		let rq = referenceQuery('context', _context);
		rq.forEach((query) => {
			boolQuery.should(query)
		});
	}

	if (destination) {
		let rq = referenceQuery('destination', destination);
		rq.forEach((query) => {
			boolQuery.should(query)
		});
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (patient) {
		let rq = referenceQuery('subject', patient);
		rq.forEach((query) => {
			boolQuery.should(query)
		});
	}

	if (performer) {
		let rq = referenceQuery('performer.actor', performer);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'performer'));
		});
	}

	if (prescription) {
		let rq = referenceQuery('authorizingPrescription', prescription);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'authorizingPrescription'));
		});
	}

	if (receiver) {
		let rq = referenceQuery('receiver', receiver);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'receiver'));
		});
	}

	if (responsibleparty) {
		let rq = referenceQuery('substitution.responsibleParty', responsibleparty);
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

	if (whenhandedover) {
		boolQuery = boolQuery.should(esb.termQuery('whenHandedOver', whenhandedover))
	}

	if (whenprepared) {
		boolQuery = boolQuery.should(esb.termQuery('whenPrepared', whenprepared))
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> search`);

	// Common search params
	let { base_version } = args;
	// Resource Specific params
	let medication = args['medication'];
	let subject = args['subject'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

	if (subject) {
		const { search: patientSearch } = require('../patient/patient.service');
		referencePromiseSearches.push(patientSearch({...subject, base_version: base_version, _rawresource: true}));
	}

	if (medication) {
		const { search: medicationSearch} = require('../medication/medication.service');
		referencePromiseSearches.push(medicationSearch({...medication, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Medication: 'medicationReference',
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

	let MedicationDispense = getMedicationDispense(base_version);

	searchId(id, indexName, MedicationDispense, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let MedicationDispense = getMedicationDispense(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, MedicationDispense, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let MedicationDispense = getMedicationDispense(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, MedicationDispense, Meta, resolve, reject, resourceName);
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

	let MedicationDispense = getMedicationDispense(base_version);

	searchId(id, `${indexName}_history`, MedicationDispense, resolve, reject, resourceName);
});
