let rawConfig = '';

for await (const chunk of process.stdin) {
  rawConfig += chunk;
}

const config = JSON.parse(rawConfig);
const services = ['backend', 'worker'];
const flags = [
  'AGENDA_LIFECYCLE_POLICY_ENABLED',
  'AGENDA_LIFECYCLE_COMMANDS_ENABLED',
  'AGENDA_EFFECTS_ENABLED',
  'AGENDA_NO_SHOW_ENABLED',
  'AGENDA_SPECIALIST_COPILOT_ENABLED',
];

for (const serviceName of services) {
  const environment = config.services?.[serviceName]?.environment;

  if (!environment) {
    throw new Error(`Servico ${serviceName} sem bloco environment renderizado`);
  }

  for (const flag of flags) {
    if (environment[flag] !== 'true') {
      throw new Error(`${flag} nao foi propagada para ${serviceName}`);
    }
  }
}

console.log('Flags de Agenda propagadas para backend e worker.');
