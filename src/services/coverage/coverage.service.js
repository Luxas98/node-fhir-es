/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { resolveSchema } = require('../../node-fhir-server');
const { identifierQuery, referenceQuery } = require('../../utils/es.querybuilder.util');
const { search: querySearch, searchId, create, _delete, update} = require('../../utils/es.helper.functions.util');
const logger = require('../../node-fhir-server').loggers.get();

let indexName = 'fhircoverage';
let resourceName = 'Coverage';

let getCoverage = (base_version) => {
	return require(resolveSchema(base_version, resourceName));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};

let buildDstu3SearchQuery = (args) => {
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag, _has} = args;

	let _class = args['class'];
	let dependent = args['dependent'];
	let group = args['group'];
	let identifier = args['identifier'];
	let payor = args['payor'];
	let plan = args['plan'];
	let policy_holder = args['policy-holder'];
	let sequence = args['sequence'];
	let subclass = args['subclass'];
	let subgroup = args['subgroup'];
	let subplan = args['subplan'];
	let subscriber = args['subscriber'];
	let type = args['type'];

	let boolQuery = esb.boolQuery();

	 if (_class) {
        boolQuery = boolQuery.should(esb.termQuery('grouping.class', _class));
    }

    if (group) {
        boolQuery = boolQuery.should(esb.termQuery('grouping.group', group));
    }

    if (dependent) {
        boolQuery = boolQuery.should(esb.termQuery('dependent', dependent));
    }

    if (identifier) {
        let identifierQueries = identifierQuery('identifier', identifier);
		identifierQueries.forEach((query) => {
			boolQuery = boolQuery.should(query);
		});
    }

    if (payor) {
    	let rq = referenceQuery('payor', payor);
		rq.forEach((query) => {
			boolQuery.should(esb.nestedQuery(query, 'payor'));
		});
    }

    if (plan) {
        boolQuery = boolQuery.should(esb.termQuery('grouping.plan', plan));
    }

    if (policy_holder) {
    	let rq = referenceQuery('policyHolder', policy_holder);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
    }

    if (sequence) {
        boolQuery = boolQuery.should(esb.termQuery('sequence', sequence));
    }

    if (subclass) {
        boolQuery = boolQuery.should(esb.termQuery('grouping.subClass', subclass));
    }

    if (subgroup) {
        boolQuery = boolQuery.should(esb.termQuery('grouping.subGroup', subgroup));
    }

    if (subplan) {
        boolQuery = boolQuery.should(esb.termQuery('grouping.subPlan', subplan))
    }

    if (subscriber) {
        // const { search: patientSearch } = require('../patient/patient.service');
		// referencePromiseSearches.push(patientSearch({...subscriber, base_version: base_version, _rawresource: true}));
        let rq = referenceQuery('subscriber', subscriber);
		rq.forEach((query) => {
			boolQuery.should(query);
		});
    }

    if (type) {
        boolQuery = boolQuery.should(esb.termQuery('type', type));
    }

    return boolQuery;
};

/**
 *
 * @param {*} args
 */
module.exports.search = (args) => new Promise((resolve, reject) => {
    logger.info(resourceName + ' >>> search');
	// Common search params
	let { base_version } = args;
	let beneficiary = args['beneficiary'];


	let boolQuery = buildDstu3SearchQuery(args);
	let referencePromiseSearches = [];


    if (beneficiary) {
		const { search: patientSearch } = require('../patient/patient.service');
		referencePromiseSearches.push(patientSearch({...beneficiary, base_version: base_version, _rawresource: true}));
	}

    let referenceResultMapping = {
		Patient: 'beneficiary'
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

	let Coverage = getCoverage(base_version);

	searchId(id, indexName, Coverage, resolve, reject, resourceName);
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> create');
	let { base_version } = args;
	let resource = req.body;

	let Coverage = getCoverage(base_version);
	let Meta = getMeta(base_version);

	create(resource, indexName, Coverage, Meta, resolve, reject);
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info(resourceName + ' >>> update');

	let { base_version, id} = args;

	let resource = req.body;

	let Coverage = getCoverage(base_version);
	let Meta = getMeta(base_version);

	update(id, resource, indexName, Coverage, Meta, resolve, reject, resourceName);
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

	let Coverage = getCoverage(base_version);

	searchId(id, `${indexName}_history`, Coverage, resolve, reject, resourceName);
});
