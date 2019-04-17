/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { RESOURCES } = require('../../constants');
const { resolveSchema } = require('../../node-fhir-server');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');
const { periodQuery, identifierQuery, codeableConceptQueries, referenceQuery, numberQuery } = require('../../utils/es.querybuilder.util');

const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhirencounter';
let resourceName = RESOURCES.ENCOUNTER;

let getBundle = (base_version) => {
	return require(resolveSchema(base_version, 'Bundle'));
};

let getEncounter = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

module.exports.everything = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> everything');


	let { base_version, id } = args;
	let relatedPromises = [];

	let Bundle = getBundle(base_version);
	let default_bundle = new Bundle({type: 'searchset', entry: []});

	this.searchById(args).then((encounter) => {
		// Temporary sanitazation of references
		const { searchById: patientSearch } = require('../patient/patient.service');
		const { search: conditionSearch } = require('../condition/condition.service');
		const { search: procedureSearch } = require('../procedure/procedure.service');
		const { search: medicationAdministrationSearch } = require('../medicationadministration/medicationadministration.service');
		const { search: observationSearch } = require('../observation/observation.service');
		const { search: diagnosticReportSearch } = require('../diagnosticreport/diagnosticreport.service');

		let resultResources = [];
		if (!encounter) {
			logger.info(`${resourceName} >>> ${id} >>> not found`);
			resolve(default_bundle);
			return;
		}
		resultResources.push({resource: encounter});
		let subject_id = '';

		if (encounter.subject && encounter.subject.reference) {
			subject_id = encounter.subject.reference.replace('urn:uuid:', '');
		}

		if (encounter.subject && encounter.subject.identifier && encounter.subject.identifier.value) {
			subject_id = encounter.subject.identifier.value.replace('urn:uuid:', '');
		}

		relatedPromises.push(patientSearch({id: subject_id, base_version: base_version, _rawresource: true}));
		relatedPromises.push(procedureSearch({context: { id: id }, base_version: base_version, _rawresource: true}));
		relatedPromises.push(conditionSearch({context: { id: id }, base_version: base_version,_rawresource: true}));
		relatedPromises.push(medicationAdministrationSearch({context: { id: id }, base_version: base_version, _rawresource: true}));
		relatedPromises.push(observationSearch({context: { id: id}, base_version: base_version, _rawresource: true}));
		relatedPromises.push(diagnosticReportSearch({context: { id: id}, base_version: base_version, _rawresource: true}));

		if (relatedPromises.length > 0) {
			Promise.all(relatedPromises).then((results) =>
				{
					results.forEach((resource) => {
						if (!resource) {
							return
						}
						if (resource.constructor === Array) {
							resource.forEach((subresource) => {
								resultResources.push({resource: subresource});
							});
						} else {
							// TODO: add fullUrl to the properties -> meta data needed
							resultResources.push({resource: resource});
						}
					});
					let resultBundle = new Bundle({total: resultResources.length, type: 'searchset', entry: resultResources});
					resolve(resultBundle);
				}
			).catch((error) => {
				logger.info(resourceName + ' related resource error >>> ' + error.toString());
				resolve(default_bundle);
			});
		}
	}).catch((error) => {
		logger.info(resourceName + ' >>> ' + error.toString());
		resolve(default_bundle);
	});
});

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	// Resource Specific params
	let id = args['id'];
	let appointment = args['appointment'];
	let _class = args['class'];
	let date = args['date'];
	let diagnosis = args['diagnosis'];
	let episodeofcare = args['episodeofcare'];
	let identifier = args['identifier'];
	let incomingreferral = args['incomingreferral'];
	let length = args['length'];
	let location = args['location'];
	let location_period = args['location-period'];
	let part_of = args['part-of'];
	let participant = args['participant'];
	let participant_type = args['participant-type'];
	let patient = args['patient'];
	let practitioner = args['practitioner'];
	let reason = args['reason'];
	let service_provider = args['service-provider'];
	let status = args['status'];
	let type = args['type'];

	let boolQuery = esb.boolQuery();

	if (id) {
		boolQuery = boolQuery.must(esb.termQuery('id', id));
	}

	if (status) {
		boolQuery = boolQuery.should(esb.termQuery('status', status));
	}

	if (_class) {
		boolQuery = boolQuery.should(esb.termQuery('class.code', _class));
		boolQuery = boolQuery.should(esb.termQuery('class.display', _class));
	}

	if (appointment) {
		boolQuery = boolQuery.should(esb.termQuery('appointment.type', appointment));
	}

	if (date) {
		boolQuery = periodQuery(boolQuery, 'period', date);
	}


	if (diagnosis) {
		let rq = referenceQuery('diagnosis.condition', diagnosis);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'diagnosis'));
		});

		let ccq = codeableConceptQueries('diagnosis.role', diagnosis);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'diagnosis'));
		});
	}

	if (episodeofcare) {
		let rq = referenceQuery('episodeOfCare', episodeofcare);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'episodeOfCare'));
		});
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (reason) {
		let ccq = codeableConceptQueries('reason', reason);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'reason'));
		});
	}

	if (incomingreferral) {
		let rq = referenceQuery('incomingReferral', incomingreferral);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'incomingReferral'));
		});
	}

	if (length) {
		boolQuery = boolQuery.should(esb.termQuery('length.code', length));
		boolQuery = numberQuery(boolQuery, 'length.value', length);
	}

	if (location) {
		boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery('location.status', location), 'location'));

		let rq = referenceQuery('location.location', location);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'location'));
		});
	}

	if (location_period) {
		boolQuery = periodQuery(boolQuery, 'location.period', location_period);
	}

	if (part_of) {
		let rq = referenceQuery('partOf', part_of);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (patient) {
		const { referenceQuery } = require('../../utils/es.querybuilder.util');
		let rq = referenceQuery('subject', patient);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (participant) {
		let ccq = codeableConceptQueries('participant.type', participant);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(esb.nestedQuery(query, 'participant.type'), 'participant'));
		});

		let rq = referenceQuery('participant.individual', practitioner);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'participant'));
		});
	}

	if (participant_type) {
		let ccq = codeableConceptQueries('participant.type', participant_type);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(esb.nestedQuery(query, 'participant.type'), 'participant'));
		});
	}

	if (service_provider) {
		let rq = referenceQuery('serviceProvider', service_provider);
		rq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (type) {
		let ccq = codeableConceptQueries(boolQuery, 'type', type);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	return boolQuery;
};

module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> search');

	// Common search params
	let { base_version } = args;

	// Resource Specific params
	let practitioner = args['practitioner'];
	let subject = args['subject'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

	if (practitioner) {
		const { search: practitionerSearch } = require('../practitioner/practitioner.service');
		referencePromiseSearches.push(practitionerSearch({...practitioner, base_version: base_version, _rawresource: true}));
	}

	if (subject) {
		const { search: patientSearch } = require('../patient/patient.service');
		referencePromiseSearches.push(patientSearch({...subject, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Patient: 'subject',
		Practitioner: 'participant'
	};

	if (referencePromiseSearches.length > 0) {
		searchReferenecePromise(referencePromiseSearches, referenceResultMapping, boolQuery, indexName, args, resolve, reject);
	} else {
		querySearch(boolQuery, indexName, args, resolve, reject);
	}
});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> searchById');

	let { base_version, id } = args;

	let Encounter = getEncounter(base_version);

	searchId(id, indexName, Encounter, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Encounter = getEncounter(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Encounter, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Encounter = getEncounter(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Encounter, Meta, resolve, reject, resourceName);
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

	let Encounter = getEncounter(base_version);

	searchId(id, `${indexName}_history`, Encounter, resolve, reject, resourceName);
});
