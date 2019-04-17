/*eslint no-unused-vars: "warn"*/
const esb = require('elastic-builder');
const { container } = require('../winston.js');
const { search: querySearch, searchReferenecePromise, searchId, create, _delete, update} = require('../../../utils/es.helper.functions.util');

let logger = container.get('default');


module.exports.search = (args) => new Promise((resolve, reject) => {
	logger.info('Global >>> search');
	// Common search params
	let { base_version, _content, _format, _id, _lastUpdated, _profile, _query, _text, _security, _tag, _type} = args;

	// Search Result params
	let { _include, _revinclude, _sort, _rawresource, _COUNT, _SUMMARY, _ELEMENTS, _CONTAINED, _CONTAINEDTYPED } = args;

	let boolQuery = esb.boolQuery();

    if (_type) {
        boolQuery = boolQuery.must(esb.termQuery('resourceType', _type));
    }

    if (_text) {
        boolQuery = boolQuery.must(esb.queryStringQuery(_text));
    }

    querySearch(boolQuery, '_all', base_version, _rawresource, _ELEMENTS, _sort, resolve, reject);

});
