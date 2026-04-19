import type { FlowStep, PlanType } from "./engine";

export type FlowSegment =
  | "salao-barbearia"
  | "restaurante"
  | "loja-de-roupas"
  | "autonomo"
  | "comercio-geral";

const createLeadCollectionSteps = (prefix: string): FlowStep[] => {
  const startId = `${prefix}-collect-name`;
  const doneId = `${prefix}-done`;

  return [
    {
      id: startId,
      kind: "collect",
      field: "name",
      prompt: "Para seguir, me diga seu nome.",
      validation: "nonEmpty",
      nextStepId: `${prefix}-collect-phone`,
      invalidPrompt: "Preciso do seu nome para continuar.",
    },
    {
      id: `${prefix}-collect-phone`,
      kind: "collect",
      field: "phone",
      prompt: "Agora me envie seu telefone com DDD.",
      validation: "phone",
      nextStepId: `${prefix}-collect-email`,
      invalidPrompt: "Envie um telefone valido com DDD, por exemplo 11999998888.",
    },
    {
      id: `${prefix}-collect-email`,
      kind: "collect",
      field: "email",
      prompt: "Qual e o seu melhor e-mail?",
      validation: "email",
      requiredPlan: "PRO",
      nextStepId: `${prefix}-collect-district`,
      invalidPrompt: "Envie um e-mail valido, por exemplo nome@exemplo.com.",
    },
    {
      id: `${prefix}-collect-district`,
      kind: "collect",
      field: "district",
      prompt: "Perfeito. Em qual bairro voce esta?",
      validation: "nonEmpty",
      requiredPlan: "PRO",
      nextStepId: doneId,
      invalidPrompt: "Me diga o nome do seu bairro para finalizar o cadastro.",
    },
  ];
};

const createClosingMessage = (prefix: string, copy: string): FlowStep => {
  return {
    id: `${prefix}-done`,
    kind: "message",
    prompt: copy,
  };
};

const createSalonFlow = (): FlowStep[] => {
  return [
    {
      id: "salao-welcome",
      kind: "message",
      prompt: "Bem-vindo ao nosso atendimento. Vou te ajudar a encontrar o melhor horario.",
      nextStepId: "salao-menu",
    },
    {
      id: "salao-menu",
      kind: "menu",
      prompt: "Escolha uma opcao:",
      options: [
        { key: "1", label: "Corte ou barba", nextStepId: "salao-service" },
        { key: "2", label: "Coloracao ou quimica", nextStepId: "salao-service" },
        { key: "3", label: "Pacotes e promocoes", nextStepId: "salao-service" },
        { key: "4", label: "Falar com atendimento", nextStepId: "salao-service" },
      ],
      invalidPrompt: "Escolha uma opcao do menu usando numero ou texto.",
    },
    {
      id: "salao-service",
      kind: "message",
      prompt: "Anotado. Vou coletar seus dados para sugerir o melhor encaixe.",
      nextStepId: "salao-collect-name",
    },
    ...createLeadCollectionSteps("salao"),
    createClosingMessage("salao", "Cadastro concluido. Em breve enviaremos sugestoes de horario."),
  ];
};

const createRestaurantFlow = (): FlowStep[] => {
  return [
    {
      id: "restaurante-welcome",
      kind: "message",
      prompt: "Oi. Posso te ajudar com reservas, delivery ou cardapio.",
      nextStepId: "restaurante-menu",
    },
    {
      id: "restaurante-menu",
      kind: "menu",
      prompt: "Como posso te ajudar hoje?",
      options: [
        { key: "1", label: "Reservar mesa", nextStepId: "restaurante-service" },
        { key: "2", label: "Pedir delivery", nextStepId: "restaurante-service" },
        { key: "3", label: "Receber cardapio", nextStepId: "restaurante-service" },
        { key: "4", label: "Evento ou grupo", nextStepId: "restaurante-service" },
      ],
      invalidPrompt: "Escolha uma opcao valida do menu.",
    },
    {
      id: "restaurante-service",
      kind: "message",
      prompt: "Perfeito. Vou pegar seus dados para agilizar o atendimento.",
      nextStepId: "restaurante-collect-name",
    },
    ...createLeadCollectionSteps("restaurante"),
    createClosingMessage("restaurante", "Recebemos seu interesse e vamos continuar o atendimento com voce."),
  ];
};

const createClothingFlow = (): FlowStep[] => {
  return [
    {
      id: "roupas-welcome",
      kind: "message",
      prompt: "Bem-vindo. Posso te ajudar a encontrar pecas, tamanhos e ofertas.",
      nextStepId: "roupas-menu",
    },
    {
      id: "roupas-menu",
      kind: "menu",
      prompt: "Escolha uma opcao:",
      options: [
        { key: "1", label: "Moda feminina", nextStepId: "roupas-service" },
        { key: "2", label: "Moda masculina", nextStepId: "roupas-service" },
        { key: "3", label: "Promocoes", nextStepId: "roupas-service" },
        { key: "4", label: "Pedido personalizado", nextStepId: "roupas-service" },
      ],
      invalidPrompt: "Escolha uma opcao valida para seguir.",
    },
    {
      id: "roupas-service",
      kind: "message",
      prompt: "Otimo. Vou registrar seus dados e direcionar sua solicitacao.",
      nextStepId: "roupas-collect-name",
    },
    ...createLeadCollectionSteps("roupas"),
    createClosingMessage("roupas", "Tudo certo. Logo enviaremos as melhores opcoes para voce."),
  ];
};

const createFreelancerFlow = (): FlowStep[] => {
  return [
    {
      id: "autonomo-welcome",
      kind: "message",
      prompt: "Oi. Vamos entender sua necessidade e organizar o proximo contato.",
      nextStepId: "autonomo-menu",
    },
    {
      id: "autonomo-menu",
      kind: "menu",
      prompt: "Qual tipo de atendimento voce procura?",
      options: [
        { key: "1", label: "Orcamento", nextStepId: "autonomo-service" },
        { key: "2", label: "Agendamento", nextStepId: "autonomo-service" },
        { key: "3", label: "Duvidas gerais", nextStepId: "autonomo-service" },
        { key: "4", label: "Urgencia", nextStepId: "autonomo-service" },
      ],
      invalidPrompt: "Escolha uma opcao valida para continuarmos.",
    },
    {
      id: "autonomo-service",
      kind: "message",
      prompt: "Perfeito. Vou coletar seus dados para retornar com prioridade.",
      nextStepId: "autonomo-collect-name",
    },
    ...createLeadCollectionSteps("autonomo"),
    createClosingMessage("autonomo", "Dados recebidos. Entraremos em contato em breve."),
  ];
};

const createRetailFlow = (): FlowStep[] => {
  return [
    {
      id: "comercio-welcome",
      kind: "message",
      prompt: "Bem-vindo. Posso ajudar com produtos, pedidos e atendimento comercial.",
      nextStepId: "comercio-menu",
    },
    {
      id: "comercio-menu",
      kind: "menu",
      prompt: "Escolha uma opcao:",
      options: [
        { key: "1", label: "Consultar produto", nextStepId: "comercio-service" },
        { key: "2", label: "Acompanhar pedido", nextStepId: "comercio-service" },
        { key: "3", label: "Promocoes", nextStepId: "comercio-service" },
        { key: "4", label: "Atendimento comercial", nextStepId: "comercio-service" },
      ],
      invalidPrompt: "Escolha uma opcao valida do menu.",
    },
    {
      id: "comercio-service",
      kind: "message",
      prompt: "Certo. Vou registrar seu contato para seguir com o atendimento.",
      nextStepId: "comercio-collect-name",
    },
    ...createLeadCollectionSteps("comercio"),
    createClosingMessage("comercio", "Seu atendimento foi iniciado. Em breve continuaremos por aqui."),
  ];
};

export const presetFlows: Record<FlowSegment, FlowStep[]> = {
  "salao-barbearia": createSalonFlow(),
  restaurante: createRestaurantFlow(),
  "loja-de-roupas": createClothingFlow(),
  autonomo: createFreelancerFlow(),
  "comercio-geral": createRetailFlow(),
};

export const getPresetFlow = (segment: FlowSegment, plan?: PlanType): FlowStep[] => {
  const flow = presetFlows[segment];

  if (!plan) {
    return flow;
  }

  return flow.map((step) => {
    if (step.kind !== "menu" || plan !== "FREE") {
      return step;
    }

    return {
      ...step,
      options: step.options.slice(0, 3),
    };
  });
};
