const FHIRServer = require('./node-fhir-server');
const esClient = require('./lib/es');
const globals = require('./globals');

const {
	fhirServerConfig
} = require('./config');



const {
	CLIENT,
	ES_HOST,
} = require('./constants');

let main = async function () {
	let client = esClient(ES_HOST);

	globals.set(CLIENT, client);
	// Test comment
	// Start our FHIR server
	let server = FHIRServer.initialize(fhirServerConfig);
	server.listen(fhirServerConfig.server.port, () => server.logger.verbose('Server is up and running!'));
};

main();
