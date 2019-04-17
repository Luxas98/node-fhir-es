const { VERSIONS } = require('@asymmetrik/node-fhir-server-core').constants;
const env = require('var');

// Set up whitelist
let whitelist_env = env.WHITELIST && env.WHITELIST.split(',').map(host => host.trim()) || false;

// If no whitelist is present, disable cors
// If it's length is 1, set it to a string, so * works
// If there are multiple, keep them as an array
let whitelist = whitelist_env && whitelist_env.length === 1
	? whitelist_env[0]
	: whitelist_env;

/**
 * @name fhirServerConfig
 * @summary @asymmetrik/node-fhir-server-core configurations.
 */
let fhirServerConfig = {
	auth: {
		// This servers URI
		resourceServer: env.RESOURCE_SERVER,
		//
		// if you use this strategy, you need to add the corresponding env vars to docker-compose
		//
		// strategy: {
		// 	name: 'bearer',
		// 	useSession: false,
		// 	service: './src/strategies/bearer.strategy.js'
		// },
	},
	server: {
		// support various ENV that uses PORT vs SERVER_PORT
		port: env.PORT || env.SERVER_PORT,
		// allow Access-Control-Allow-Origin
		corsOptions: {
			maxAge: 86400,
			origin: whitelist
		}
	},
	logging: {
		level: env.LOGGING_LEVEL
	},
	//
	// If you want to set up conformance statement with security enabled
	// Uncomment the following block
	//
	// security: [
	// 	{
	// 		url: 'authorize',
	// 		valueUri: `${env.AUTH_SERVER_URI}/authorize`
	// 	},
	// 	{
	// 		url: 'token',
	// 		valueUri: `${env.AUTH_SERVER_URI}/token`
	// 	}
	// 	// optional - registration
	// ],
	//
	// Add any profiles you want to support.  Each profile can support multiple versions
	// if supported by core.  To support multiple versions, just add the versions to the array.
	//
	// Example:
	// Account: {
	//		service: './src/services/account/account.service.js',
	//		versions: [ VERSIONS['4_0_0'], VERSIONS['3_0_1'], VERSIONS['1_0_2'] ]
	// },
	//
	profiles: {
		AllergyIntolerance: {
			service: './src/services/allergyintolerance/allergyintolerance.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		Appointment: {
			service: './src/services/appointment/appointment.service.js',
			versions: [ VERSIONS['3_0_1']]
		},
		Consent: {
			service: './src/services/consent/consent.service.js',
			versions: [ VERSIONS['3_0_1']]
		},
		Coverage: {
			service: './src/services/coverage/coverage.service.js',
			versions: [ VERSIONS['3_0_1']]
		},
		Device: {
			service: './src/services/device/device.service.js',
			versions: [ VERSIONS['3_0_1']]
		},
		DeviceRequest: {
			service: './src/services/devicerequest/devicerequest.service.js',
			versions: [ VERSIONS['3_0_1']]
		},
		DeviceUseStatement: {
			service: './src/services/deviceusestatement/deviceusestatement.service.js',
			versions: [ VERSIONS['3_0_1']]
		},
		Flag: {
			service: './src/services/flag/flag.service.js',
			versions: [ VERSIONS['3_0_1']]
		},
		Organization: {
			service: './src/services/organization/organization.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		Patient: {
			service: './src/services/patient/patient.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		Encounter: {
			service: './src/services/encounter/encounter.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		Immunization: {
			service: './src/services/immunization/immunization.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		ImmunizationRecommendation: {
			service: './src/services/immunizationrecommendation/immunizationrecommendation.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		Observation: {
			service: './src/services/observation/observation.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		Condition: {
			service: './src/services/condition/condition.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		Practitioner: {
			service: './src/services/practitioner/practitioner.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		PractitionerRole: {
			service: './src/services/practitionerrole/practitionerrole.service.js',
			versions: [ VERSIONS['3_0_1']]
		},
		Procedure: {
			service: './src/services/procedure/procedure.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		ProcedureRequest: {
			service: './src/services/procedurerequest/procedurerequest.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		Specimen: {
			service: './src/services/specimen/specimen.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		Medication: {
			service: './src/services/medication/medication.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		MedicationAdministration: {
			service: './src/services/medicationadministration/medicationadministration.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		MedicationDispense: {
			service: './src/services/medicationdispense/medicationdispense.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		MedicationRequest: {
			service: './src/services/medicationrequest/medicationrequest.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		MedicationStatement: {
			service: './src/services/medicationstatement/medicationstatement.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		NutritionOrder: {
			service: './src/services/nutritionorder/nutritionorder.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		},
		DiagnosticReport: {
			service: './src/services/diagnosticreport/diagnosticreport.service.js',
			versions: [ VERSIONS['3_0_1'] ]
		}
	}
};

module.exports = {
	fhirServerConfig
};
