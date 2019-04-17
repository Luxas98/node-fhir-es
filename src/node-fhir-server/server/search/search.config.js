const controller = require('./search.controller.js');
const { route_args } = require('../route.config.js');

let route = {
	type: 'get',
	path: '/:base_version',
	corsOptions: {
		methods: ['GET'],
	},
	args: [route_args.BASE],
	controller: controller.search,
};

/**
 * @name exports
 * @summary Metadata config
 */
module.exports = {
	route,
};
