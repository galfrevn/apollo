import type { LandingMessages } from '@/landing/copy/messages';

export const LANDING_MESSAGES_ES: LandingMessages = {
  metadata: {
    documentTitle: 'Apollo | Tu agente personal de escritorio',
    documentDescription:
      'El cerebro open source para dispositivos agénticos físicos: voz, memoria, agenda y herramientas, corriendo en tu propia cuenta de Cloudflare.',
  },
  nav: {
    docsLabel: 'Docs',
    githubLabel: 'GitHub',
    openConsoleLabel: 'Abrir consola →',
  },
  hero: {
    lineOne: 'Tu agente personal',
    lineTwo: 'de escritorio',
    subhead:
      'El cerebro open source para dispositivos agénticos físicos. Vive en tu cuenta de Cloudflare; el cuerpo descansa en tu escritorio.',
    gettingStartedLabel: 'Primeros pasos →',
  },
  showcase: {
    actIndexLabel: '01 · Escuchar',
    actTitle: 'Hablas. Te responde.',
    intro: {
      lead: 'Sin app, sin teclado. ',
      emphasis: 'Le hablas desde el otro lado del escritorio',
      trail: ' y la respuesta vuelve en voz alta, desde una cara que escucha contigo.',
    },
    exchangeCellLabel: 'El intercambio',
    conversationTurnList: [
      {
        speakerLabel: 'Palabra de activación',
        spokenText: '“Hey, Apollo.”',
        isReply: false,
      },
      {
        speakerLabel: 'Tú',
        spokenText: '“¿Qué me queda en la lista para hoy?”',
        isReply: false,
      },
      {
        speakerLabel: 'Apollo',
        spokenText: '“Dos cosas: la revisión de diseño y regar la planta detrás de ti.”',
        isReply: true,
      },
    ],
    deskCellLabel: 'Escritorio',
    liveLabel: 'En vivo',
    faceCaption:
      'La cara sigue el turno: curiosa, concentrada, hablando. También sigue el cursor.',
    wakeWordCellLabel: 'La palabra de activación',
    wakeWordCaption:
      'Despierta con la frase; solo entonces el audio sale del escritorio.',
    replyCellLabel: 'La respuesta',
    replyHeadline: 'Una oración, dicha en voz alta.',
    replyCaption: 'De pregunta a respuesta en un solo viaje, afinado para un escritorio.',
    memoryCellLabel: 'Memoria',
    memoryCaption: 'Dilo una vez; lo recuerda cuando importa.',
    remindersCellLabel: 'Recordatorios',
    remindersCaption: 'Temporizadores que suenan en el propio dispositivo.',
    liveAnswersCellLabel: 'Respuestas en vivo',
    liveAnswersCaption: 'Investigación web condensada en una oración.',
    codingCellLabel: 'Agente de código',
    codingTerminalText: 'apollo run · abriendo un pull request',
    codingCaption:
      'Trabajo real sobre repositorios, delegado con una oración y reportado en voz alta.',
    toolsCellLabel: 'Tus herramientas',
    toolsCaption: 'Los servicios que ya usas, por MCP.',
  },
  architecture: {
    actIndexLabel: '02 · Pensar',
    actTitle: 'Un cerebro, cualquier cuerpo.',
    intro: {
      lead: 'Cada turno recorre un solo camino: el cuerpo transmite tu voz a ',
      emphasis: 'un Durable Object en tu cuenta de Cloudflare',
      trail:
        '. Recuerda, decide, toma herramientas y responde en una oración. Al cerebro no le importa qué es el cuerpo.',
    },
    bodyNodeLabel: 'El cuerpo',
    bodyNodeHeadline: 'Un micrófono, un parlante, una cara.',
    bodyNodeDetail: 'Cualquier dispositivo que hable el protocolo',
    voiceWireLabel: 'voz →',
    replyWireLabel: '← respuesta',
    brainNodeLabel: 'El cerebro',
    brainNodeHeadline: 'Un Durable Object por dispositivo, en tu cuenta.',
    brainNodeMonoLine: 'turnos · memoria · persona · agenda',
    brainNodeDetail: 'Cloudflare Worker',
    toolNodeList: [
      { name: 'Herramientas', detail: 'servidores MCP, búsqueda, un sandbox de código' },
      { name: 'R2', detail: 'medios que el agente graba y sirve' },
      { name: 'Vectorize', detail: 'memoria, recordada por significado' },
    ],
  },
  capabilities: {
    actIndexLabel: '03 · Actuar',
    actTitle: 'La charla no es el punto.',
    intro: {
      lead: 'Apollo existe para hacer cosas: ',
      emphasis: 'recordar, avisar, investigar y publicar',
      trail: ', todo desde una oración dicha frente al escritorio.',
    },
    capabilityRowList: [
      {
        indexLabel: '3.1',
        name: 'Turnos de voz',
        description:
          'Respuestas habladas y breves, afinadas para un dispositivo en el escritorio, no para una ventana de chat.',
        tag: 'Siempre activo',
      },
      {
        indexLabel: '3.2',
        name: 'Memoria',
        description: 'Recuerda lo que le dices y lo trae de vuelta cuando importa.',
        tag: 'Vectorize',
      },
      {
        indexLabel: '3.3',
        name: 'Recordatorios',
        description: 'Temporizadores y agendas que suenan en el propio dispositivo.',
        tag: 'En el dispositivo',
      },
      {
        indexLabel: '3.4',
        name: 'Respuestas en vivo',
        description: 'Investigación web condensada en una oración accionable.',
        tag: 'Búsqueda',
      },
      {
        indexLabel: '3.5',
        name: 'Agente de código',
        description:
          'Delega trabajo real sobre repositorios a un motor aislado y luego lo reporta en voz alta.',
        tag: 'Sandbox',
      },
      {
        indexLabel: '3.6',
        name: 'Tus herramientas',
        description:
          'Se conecta por MCP a los servicios que ya usas, administrados desde la consola.',
        tag: 'MCP',
      },
    ],
  },
  yours: {
    actIndexLabel: '04 · Tuyo',
    actTitle: 'Corre en tu cuenta. No le responde a nadie más.',
    introLead: 'Open source de punta a punta: la memoria, los medios, las claves. ',
    introEmphasis: 'Desplégalo una vez y es tuyo.',
    ownershipCardList: [
      {
        label: 'El cerebro',
        description:
          'Turnos de voz, memoria, herramientas y agenda en un solo Durable Object.',
        action: 'Un comando para desplegar.',
      },
      {
        label: 'El cuerpo',
        description: 'El firmware del dispositivo en tu escritorio.',
        action: 'Flashéalo. Déjalo en su lugar.',
      },
    ],
    docsCardLabel: 'La documentación',
    docsCardDescription:
      'Un manual para cada parte: protocolo, memoria, persona, operaciones.',
    docsCardAction: 'Leer la documentación →',
    consoleCardLabel: 'La consola',
    consoleCardDescription: 'Todo lo que sabe y planea, en vivo desde tu worker.',
    consoleCardAction: 'Abrir consola →',
  },
  footer: {
    echoWordList: ['El', 'escritorio', 'está', 'escuchando'],
    wakePhrase: '“Hey, Apollo.”',
    builtByPrefix: 'Hecho por ',
  },
};
