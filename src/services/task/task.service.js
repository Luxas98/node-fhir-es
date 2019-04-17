/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { RESOURCES } = require('../../constants');
const { resolveSchema } = require('../../node-fhir-server');
const { codeableConceptQueries, codeQuery, periodQuery, identifierQuery, referenceQuery} = require('../../utils/es.querybuilder.util');
const { search: patientSearch } = require('../patient/patient.service');
const logger = require('../../node-fhir-server').loggers.get();
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');


let indexName = 'fhirtask';
let resourceName = RESOURCES.TASK;

let getTask = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag} = args;

	let authored_on = args['authored-on'];
	let based_on = args['based-on'];
	let business_status = args['business-status'];
	let code = args['code'];
	let _context = args['context'];
	let focus = args['focus'];
	let group_identifier = args['group-identifier'];
	let identifier = args['identifier'];
	let intent = args['intent'];
	let modified = args['modified'];
	let organization = args['organization'];
	let owner = args['owner'];
	let part_of = args['part-of'];
	let patient = args['patient'];
	let performer = args['performer'];
	let period = args['period'];
	let priority = args['priority'];
	let requester = args['requester'];
	let status = args['status'];

	let boolQuery = esb.boolQuery();

	if (authored_on) {
		boolQuery = boolQuery.should(esb.termQuery('authoredOn', authored_on));
	}

	if (based_on) {
		let rq = referenceQuery('basedOn', based_on);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'basedOn'));
		});
	}

	if (business_status) {
		let ccq = codeableConceptQueries('businessStatus', business_status);
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

	if (_context) {
		let rq = referenceQuery('context', _context);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (focus) {
		let rq = referenceQuery('focus', focus);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (group_identifier) {
		boolQuery = codeQuery(boolQuery, 'groupIdentifier', group_identifier);
	}

	if (identifier) {
		let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
	}

	if (intent) {
		boolQuery = boolQuery.should(esb.termQuery('intent', intent));
	}

	if (modified) {
		boolQuery = boolQuery.should(esb.termQuery('lastModified', modified));
	}

	if (organization) {
		let rq = referenceQuery('requester.onBehalfOf', organization);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (owner) {
		let rq = referenceQuery('owner', owner);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (part_of) {
		let rq = referenceQuery('partOf', part_of);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'partOf'));
		});
	}

	if (patient) {
		let rq = referenceQuery('for', patient);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
	}

	if (performer) {
		let ccq = codeableConceptQueries('performerType', performer);
		ccq.forEach((query) => {
			boolQuery = boolQuery.should(esb.nestedQuery(query, 'performerType'));
		});
	}

	if (period) {
		boolQuery = periodQuery(boolQuery, 'executionPeriod', period);
	}

	if (priority) {
		boolQuery = boolQuery.should(esb.termQuery('priority', priority));
	}

	if (requester) {
		let rq = referenceQuery('requester.agent', requester);
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
	logger.info(`${resourceName} >>> search`);

	// Common search params
	let { base_version} = args;

	// Resource Specific params
	let subject = args['subject'];

	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];

	if (subject) {
		referencePromiseSearches.push(patientSearch({...subject, base_version: base_version, _rawresource: true}));
	}

	let referenceResultMapping = {
		Patient: 'subject'
	};

	if (referencePromiseSearches.length > 0) {
		searchReferenecePromise(referencePromiseSearches, referenceResultMapping, boolQuery, indexName, resolve, reject); // TODO: do we want to propagate elements to referenced objects?
	} else {
		querySearch(boolQuery, indexName, args, resolve, reject);
	}

});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> searchById');

	let { base_version, id } = args;

	let Task = getTask(base_version);

	searchId(id, indexName, Task, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Task = getTask(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Task, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Task = getTask(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Task, Meta, resolve, reject, resourceName)
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

	let Task = getTask(base_version);

	searchId(id, `${indexName}_history`, Task, resolve, reject, resourceName);
});
