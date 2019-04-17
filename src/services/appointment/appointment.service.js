/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { RESOURCES } = require('../../constants');
const { search: querySearch, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');

const { codeableConceptQueries, identifierQuery, dateQuery, referenceQuery} = require('../../utils/es.querybuilder.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirappointment';
let resourceName = RESOURCES.APPOINTMENT;

let getAppointment = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let actor = args['actor'];
	let appointment_type = args['appointment-type'];
	let date = args['date'];
	let identifier = args['identifier'];
	let incomingreferral = args['incomingreferral'];
	let location = args['location'];
	let part_status = args['part-status'];
	let patient = args['patient'];
	let practitioner = args['practitioner'];
	let service_type = args['service-type'];
	let status = args['status'];

	let boolQuery = esb.boolQuery();

	if (actor) {
		let rq = referenceQuery('participant.actor', actor);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'participant'));
		});
	}

	if (appointment_type) {
		let ccq = codeableConceptQueries('appointmentType', appointment_type);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (date) {
		boolQuery = dateQuery(boolQuery, 'start', date);
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (incomingreferral) {
		let rq = referenceQuery('incomingReferral', incomingreferral);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'incomingReferral'));
		});
	}

	if (location) {
		let rq = referenceQuery('participant.actor', location);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'participant'));
		});
	}

	if (part_status) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('participant.status', part_status), 'participant'));
	}

	if (patient) {
		let rq = referenceQuery('participant.actor', patient);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'participant'));
		});
	}

	if (practitioner) {
		let rq = referenceQuery('participant.actor', practitioner);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'participant'));
		});
	}

	if (service_type) {
		let ccq = codeableConceptQueries('serviceType', service_type);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'serviceType'));
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

	let Appointment = getAppointment(base_version);

	searchId(id, indexName, Appointment, resolve, reject, resourceName);
});


module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Appointment = getAppointment(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Appointment, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Appointment = getAppointment(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Appointment, Meta, resolve, reject, resourceName);
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
	resolve();
});

module.exports.historyById = (args) => new Promise((resolve, reject) => {
	logger.info(`${resourceName} >>> historyBtId`);
	resolve();
});
