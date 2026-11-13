import { Injectable } from '@nestjs/common';

export interface MissionMessageDetails {
  id: string;
  description: string | null;
  metier: string;
  zone: string;
  dateMission: Date;
  remunerationFcfa: bigint;
}

@Injectable()
export class WhatsappTemplateService {
  missionProposal(to: string, mission: MissionMessageDetails): Record<string, unknown> {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: [
            mission.description ?? 'Nouvelle mission',
            `Métier : ${mission.metier}`,
            `Zone : ${mission.zone}`,
            `Date : ${mission.dateMission.toISOString().slice(0, 10)}`,
            `Rémunération : ${mission.remunerationFcfa.toString()} FCFA`,
          ].join('\n'),
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: `xeuysil:proposal:${mission.id}:accept`, title: 'ACCEPTER' } },
            { type: 'reply', reply: { id: `xeuysil:proposal:${mission.id}:reject`, title: 'REFUSER' } },
          ],
        },
      },
    };
  }

  missionSelection(to: string, mission: MissionMessageDetails, applicationId: string): Record<string, unknown> {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: [
            'Vous avez été sélectionné.',
            mission.description ?? 'Mission',
            `Métier : ${mission.metier}`,
            `Zone : ${mission.zone}`,
            `Date : ${mission.dateMission.toISOString().slice(0, 10)}`,
            `Rémunération : ${mission.remunerationFcfa.toString()} FCFA`,
          ].join('\n'),
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: `xeuysil:selection:${applicationId}:confirm`, title: 'CONFIRMER' } },
            { type: 'reply', reply: { id: `xeuysil:selection:${applicationId}:decline`, title: 'DECLINER' } },
          ],
        },
      },
    };
  }

  missionReminder(to: string, mission: MissionMessageDetails, reminderText: string): Record<string, unknown> {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: `${reminderText}\n${mission.description ?? 'Mission'}\n${mission.dateMission.toISOString().slice(0, 10)} · ${mission.zone}`,
      },
    };
  }
}
