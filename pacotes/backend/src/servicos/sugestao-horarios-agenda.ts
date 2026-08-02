import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const TIMEZONE_AGENDA = 'America/Sao_Paulo';

export type PeriodoPreferido = 'qualquer' | 'manha' | 'tarde';

export interface SlotAgenda {
  inicio: string;
  fim: string;
  duracaoMin: number;
}

export interface ConflitoAgendaLocal {
  agendadoPara: Date;
  duracao?: number | null;
}

function periodoDoSlot(slot: SlotAgenda): Exclude<PeriodoPreferido, 'qualquer'> {
  const hora = Number(formatInTimeZone(new Date(slot.inicio), TIMEZONE_AGENDA, 'HH'));
  return hora < 12 ? 'manha' : 'tarde';
}

function conflitaComAgendaLocal(slot: SlotAgenda, conflitos: ConflitoAgendaLocal[]): boolean {
  const inicio = new Date(slot.inicio).getTime();
  const fim = new Date(slot.fim).getTime();
  return conflitos.some((conflito) => {
    const conflitoInicio = conflito.agendadoPara.getTime();
    const conflitoFim = conflitoInicio + (conflito.duracao || 30) * 60_000;
    return inicio < conflitoFim && fim > conflitoInicio;
  });
}

export function gerarSlotsComerciaisLocais(agora = new Date(), diasConsulta = 7): SlotAgenda[] {
  const dataInicialLocal = formatInTimeZone(agora, TIMEZONE_AGENDA, 'yyyy-MM-dd');
  const inicioDia = fromZonedTime(`${dataInicialLocal}T00:00:00`, TIMEZONE_AGENDA);
  const slots: SlotAgenda[] = [];

  for (let deslocamento = 0; deslocamento <= diasConsulta; deslocamento++) {
    const diaBase = addDays(inicioDia, deslocamento);
    const dataLocal = formatInTimeZone(diaBase, TIMEZONE_AGENDA, 'yyyy-MM-dd');
    const diaSemana = Number(formatInTimeZone(diaBase, TIMEZONE_AGENDA, 'i'));
    if (diaSemana > 5) continue;

    for (let hora = 8; hora < 18; hora++) {
      for (const minuto of [0, 30]) {
        const inicio = fromZonedTime(
          `${dataLocal}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00`,
          TIMEZONE_AGENDA,
        );
        if (inicio.getTime() <= agora.getTime() + 30 * 60_000) continue;
        const fim = new Date(inicio.getTime() + 30 * 60_000);
        slots.push({ inicio: inicio.toISOString(), fim: fim.toISOString(), duracaoMin: 30 });
      }
    }
  }

  return slots;
}

export function selecionarSugestoesDeHorario(params: {
  slots: SlotAgenda[];
  conflitosLocais?: ConflitoAgendaLocal[];
  periodoPreferido?: PeriodoPreferido;
  limite?: number;
  agora?: Date;
}): SlotAgenda[] {
  const agora = params.agora || new Date();
  const periodo = params.periodoPreferido || 'qualquer';
  const limite = params.limite || 2;
  const conflitos = params.conflitosLocais || [];
  const elegiveis = params.slots
    .filter((slot) => new Date(slot.inicio).getTime() > agora.getTime())
    .filter((slot) => periodo === 'qualquer' || periodoDoSlot(slot) === periodo)
    .filter((slot) => !conflitaComAgendaLocal(slot, conflitos))
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

  if (periodo !== 'qualquer') return elegiveis.slice(0, limite);

  // Oferece variedade sem despejar uma lista: primeiro slot livre e, se
  // possível, uma alternativa em outro período do dia.
  const primeira = elegiveis[0];
  if (!primeira || limite === 1) return primeira ? [primeira] : [];
  const periodoPrimeira = periodoDoSlot(primeira);
  const alternativa = elegiveis.find((slot) => periodoDoSlot(slot) !== periodoPrimeira)
    || elegiveis[1];
  return alternativa ? [primeira, alternativa].slice(0, limite) : [primeira];
}

export function formatarSugestaoHorario(slot: SlotAgenda): string {
  return formatInTimeZone(new Date(slot.inicio), TIMEZONE_AGENDA, 'dd/MM/yyyy HH:mm');
}
