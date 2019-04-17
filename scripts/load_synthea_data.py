import glob
import json
import requests
fhir_bundles = glob.glob('../fhir_stu3/*.json')

URL = 'http://localhost:3001/3_0_1'

loadable_resources = ['AllergyIntolerance', 'Condition', 'DiagnosticReport', 'Encounter', 'MedicationAdministration', 'MedicationRequest', 'Observation', 'Organization', 'Patient', 'Procedure', 'Immunization']

for fhir_bundle in fhir_bundles:
    with open(fhir_bundle, 'r') as fhir_file:
        fhir_json_bundle = json.load(fhir_file)
        entries = fhir_json_bundle['entry']
        for entry in entries:
            resource = entry['resource']
            if resource['resourceType'] in loadable_resources:
                response = requests.post(f'{URL}/{resource["resourceType"]}', json=resource,  headers={"Content-Type":"application/json+fhir"})
                if response.status_code > 299:
                    import ipdb
                    ipdb.set_trace()

                print(resource['resourceType'], response.text, response.status_code)
            else:
                print(resource['resourceType'], 'Skipping')

