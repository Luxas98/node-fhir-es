const esb = require('elastic-builder');


let codeableConceptQueries = (field_name, field_value) => {
	let queryCodingDisplay = esb.nestedQuery(esb.termQuery(`${field_name}.coding.display`, field_value), `${field_name}.coding`);

	let queryCodingCode = esb.nestedQuery(esb.termQuery(`${field_name}.coding.code`, field_value), `${field_name}.coding`);

	let queryCodingText = esb.termQuery(`${field_name}.text`, field_value);

	return [queryCodingCode, queryCodingDisplay, queryCodingText];
};


let codeQuery = (original_query, field_name, field_value) => {
	let boolQuery = original_query;

	boolQuery = boolQuery.should(esb.termQuery(`${field_name}.value`, field_value));
	boolQuery = boolQuery.should(esb.termQuery(`${field_name}.type.text`, field_value));

	return boolQuery;
};

let identifierQuery = (identifier_field, identifier_value) => {
	let valueQuery = esb.nestedQuery(esb.termQuery(`${identifier_field}.value`, identifier_value), `${identifier_field}`);
	let useQuery = esb.nestedQuery(esb.termQuery(`${identifier_field}.use`, identifier_value), `${identifier_field}`);

	let typeQuery = esb.nestedQuery(esb.termQuery(`${identifier_field}.type.text`, identifier_value), `${identifier_field}`);

	return [valueQuery, useQuery, typeQuery];
};

let referenceQuery = (reference_field, reference_value) => {
	if (typeof reference_value === 'object' ) {
		reference_value = reference_value.id;
	}

	let referenceQuery_ = esb.termsQuery(`${reference_field}.reference`, reference_value);
	let displayQuery = esb.termsQuery(`${reference_field}.display`, reference_value);
	let identifierQueries = identifierQuery(`${reference_field}.identifier`, reference_value);

	return [referenceQuery_, displayQuery].concat(identifierQueries);
};

let periodQuery = (original_query, field_name, field_value) => {
	let regex = /^(\D{2})?(\d{4})(-\d{2})?(-\d{2})?(?:(T\d{2}:\d{2})(:\d{2})?)?(Z|(\+|-)(\d{2}):(\d{2}))?$/;
	let match = field_value.match(regex);
	let date = '';
	let timeZone = '+01:00';
	let boolQuery = original_query;
	if (match && match.lenght >= 1) {
		if (match[2] && match[3] && match[4]) {
			date = `${match[2]}${match[3]}${match[4]}`;
		}

		if (match[5] && match[6]) {
			date = `${date}${match[5]}${match[6]}`;
		}

		if (match[7]) {
			timeZone = match[7];
		}
	}
	else {
		date = field_value;
	}

	boolQuery = boolQuery.must(esb.rangeQuery(`${field_name}.start`).lte(date).timeZone(timeZone));
	boolQuery = boolQuery.must(esb.rangeQuery(`${field_name}.end`).gte(date).timeZone(timeZone));

  return boolQuery;
};

let dateQuery = (original_query, field, date) => {
	let regex = /^(\D{2})?(\d{4})(-\d{2})?(-\d{2})?(?:(T\d{2}:\d{2})(:\d{2})?)?(Z|(\+|-)(\d{2}):(\d{2}))?$/;
	let match = date.match(regex);
	let prefix = '';
	let timeZone = '+00:00';
	let boolQuery = original_query;
	if (match && match.length >= 1 ) {
		if (match[1]) {
			prefix = match[1];
		}

		if (match[2] && match[3] && match[4]) {
			date = `${match[2]}${match[3]}${match[4]}`;
		}

		if (match[5] && match[6]) {
			date = `${date}${match[5]}${match[6]}`;
		}

		if (match[10]) {
			timeZone = `${match[8]}${match[9]}:${match[10]}`;
		}

		if (prefix === 'ge') {
			boolQuery = boolQuery.should(esb.rangeQuery(`${field}`).gte(date).timeZone(timeZone));
		}

		if (prefix === 'le') {
			boolQuery = boolQuery.should(esb.rangeQuery(`${field}`).lte(date).timeZone(timeZone));
		}

		if (prefix === 'gt') {
			boolQuery = boolQuery.should(esb.rangeQuery(`${field}`).gt(date).timeZone(timeZone));
		}

		if (prefix === 'lt') {
			boolQuery = boolQuery.should(esb.rangeQuery(`${field}`).lt(date).timeZone(timeZone));
		}

		if (prefix === 'eq') {
			boolQuery = boolQuery.should(esb.termQuery(`${field}`, date));
		}
	}

	return boolQuery;
};

let rangeQuery = (original_query, field_name, field_value) => {
	let boolQuery = original_query;

	boolQuery = boolQuery.should(esb.rangeQuery(`${field_name}.low`).lte(field_value));
	boolQuery = boolQuery.should(esb.rangeQuery(`${field_name}.high`).gte(field_value));

	return boolQuery;
};

let numberQuery = (original_query, field_name, field_value) => {
	let prefix = '';
	let number = '';
	let sigfigs = '';
	let boolQuery = original_query;

	// Check if there is a prefix
	if (isNaN(field_value)) {
		prefix = field_value.substring(0, 2);
		number = parseFloat(field_value.substring(2));
		sigfigs = field_value.substring(2);
	}
	else {
		number = parseFloat(field_value);
		sigfigs = field_value;
	}

	switch (prefix) {
		case 'lt':
			return boolQuery.must(esb.rangeQuery(field_name).lt(number));
		case 'le' :
			return boolQuery.must(esb.rangeQuery(field_name).lte(number));
		case 'gt':
			return boolQuery.must(esb.rangeQuery(field_name).gt(number));
		case 'ge':
			return boolQuery.must(esb.rangeQuery(field_name).gte(number));
	}

	// Return an approximation query
	let decimals = sigfigs.split('.')[1];
	if (decimals) {
		decimals = decimals.length + 1;
	}
	else {
		decimals = 1;
	}
	let aprox = (1 / 10 ** decimals) * 5;

	boolQuery = boolQuery.must(esb.rangeQuery(field_name).gte(number - aprox).lte(number + aprox));

	return boolQuery;
};

let quantityQuery = (original_query, field_name, value_quantity) => {
    let boolQuery = original_query;

    if (value_quantity && value_quantity['code']) {
		boolQuery = boolQuery.must(esb.termQuery(`${field_name}.code`, value_quantity['code']));
	}

	if (value_quantity && value_quantity['value']) {
		boolQuery = numberQuery(boolQuery, `${field_name}.value`, value_quantity['value']);
	}

	if (value_quantity && value_quantity['unit']) {
		boolQuery = boolQuery.must(esb.termQuery(`${field_name}.unit`, value_quantity['unit']));
	}

	return boolQuery;
};

let annotationQuery = (original_query, field_name, text) => {
	let boolQuery = original_query;
	boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery(`${field_name}.text`, text), field_name));
	boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery(`${field_name}.time`, text), field_name));
	boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery(`${field_name}.authorReference`, text), field_name));
	boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery(`${field_name}.authorString`, text), field_name));
	return boolQuery;

};

let addressQuery = (original_query, address_field, address) => {
	let boolQuery = original_query;
	boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery(`${address_field}.city`, address), `${address_field}`));
	boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery(`${address_field}.country`, address), `${address_field}`));
	boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery(`${address_field}.postalCode`, address), `${address_field}`));
	boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery(`${address_field}.state`, address), `${address_field}`));
	boolQuery = boolQuery.should(esb.nestedQuery(esb.termQuery(`${address_field}.use`, address), `${address_field}`));

	return boolQuery;
};



module.exports = {
	annotationQuery,
	addressQuery,
	codeableConceptQueries,
	codeQuery,
	dateQuery,
	identifierQuery,
	numberQuery,
    periodQuery,
    quantityQuery,
	rangeQuery,
	referenceQuery
};
