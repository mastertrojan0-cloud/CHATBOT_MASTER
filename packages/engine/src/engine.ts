export type PlanType = "FREE" | "PRO";

export type FlowStepKind = "message" | "menu" | "collect";

export type LeadField = "name" | "phone" | "email" | "district";

export interface FlowLead {
  name?: string;
  phone?: string;
  email?: string;
  district?: string;
}

export interface FlowContext {
  plan: PlanType;
  currentStepId?: string;
  messageCount: number;
  completed: boolean;
  collectedLead: FlowLead;
}

export interface FlowStepBase {
  id: string;
  kind: FlowStepKind;
  prompt: string;
}

export interface FlowMenuOption {
  key: string;
  label: string;
  nextStepId: string;
}

export interface MessageStep extends FlowStepBase {
  kind: "message";
  nextStepId?: string;
}

export interface MenuStep extends FlowStepBase {
  kind: "menu";
  options: FlowMenuOption[];
  invalidPrompt?: string;
}

export interface CollectStep extends FlowStepBase {
  kind: "collect";
  field: LeadField;
  nextStepId?: string;
  requiredPlan?: PlanType;
  validation?: "nonEmpty" | "phone" | "email";
  invalidPrompt?: string;
}

export type FlowStep = MessageStep | MenuStep | CollectStep;

export interface EngineResponse {
  stepId: string;
  text: string;
}

export interface EngineOutput {
  responses: EngineResponse[];
  nextContext: FlowContext;
  lead?: FlowLead;
}

const FREE_MAX_MESSAGES = 200;
const FREE_MAX_MENU_OPTIONS = 3;

const DEFAULT_INVALID_MESSAGE = "Nao entendi sua resposta. Tente novamente.";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneSanitizePattern = /\D/g;

const cloneLead = (lead: FlowLead): FlowLead => ({ ...lead });

const normalizeText = (value: string): string => value.trim();

const sanitizePhone = (value: string): string => value.replace(phoneSanitizePattern, "");

const createStepMap = (steps: FlowStep[]): Map<string, FlowStep> => {
  return new Map(steps.map((step) => [step.id, step]));
};

const getFirstStep = (steps: FlowStep[]): FlowStep => {
  if (steps.length === 0) {
    throw new Error("FlowStep[] cannot be empty.");
  }

  return steps[0]!;
};

const getStepById = (stepMap: Map<string, FlowStep>, stepId?: string): FlowStep => {
  const fallback = stepMap.values().next().value as FlowStep | undefined;

  if (!stepId) {
    if (!fallback) {
      throw new Error("FlowStep[] cannot be empty.");
    }

    return fallback;
  }

  const step = stepMap.get(stepId);

  if (!step) {
    throw new Error(`Flow step "${stepId}" was not found.`);
  }

  return step;
};

const isStepAllowedForPlan = (step: FlowStep, plan: PlanType): boolean => {
  if (step.kind !== "collect" || !step.requiredPlan) {
    return true;
  }

  return step.requiredPlan === plan;
};

const getRawNextStepId = (step: FlowStep): string | undefined => {
  if (step.kind === "menu") {
    return undefined;
  }

  return step.nextStepId;
};

const getNextAllowedStepId = (
  stepMap: Map<string, FlowStep>,
  nextStepId: string | undefined,
  plan: PlanType,
): string | undefined => {
  let cursor = nextStepId;

  while (cursor) {
    const step = stepMap.get(cursor);

    if (!step) {
      throw new Error(`Flow step "${cursor}" was not found.`);
    }

    if (isStepAllowedForPlan(step, plan)) {
      return step.id;
    }

    cursor = getRawNextStepId(step);
  }

  return undefined;
};

const isLeadComplete = (lead: FlowLead, plan: PlanType): boolean => {
  const hasFreeFields = Boolean(lead.name && lead.phone);

  if (plan === "FREE") {
    return hasFreeFields;
  }

  return hasFreeFields && Boolean(lead.email && lead.district);
};

const buildMenuPrompt = (step: MenuStep, plan: PlanType): string => {
  const options = plan === "FREE" ? step.options.slice(0, FREE_MAX_MENU_OPTIONS) : step.options;
  const lines = options.map((option, index) => `${index + 1}. ${option.label}`);

  return [step.prompt, ...lines].join("\n");
};

const toMenuOptions = (step: MenuStep, plan: PlanType): FlowMenuOption[] => {
  return plan === "FREE" ? step.options.slice(0, FREE_MAX_MENU_OPTIONS) : step.options;
};

const validateFieldValue = (step: CollectStep, userMessage: string): string | undefined => {
  const normalized = normalizeText(userMessage);

  if (normalized.length === 0) {
    return undefined;
  }

  if (step.validation === "phone") {
    const phone = sanitizePhone(normalized);
    return phone.length >= 10 ? phone : undefined;
  }

  if (step.validation === "email") {
    return emailPattern.test(normalized) ? normalized.toLowerCase() : undefined;
  }

  return normalized;
};

const updateLeadField = (lead: FlowLead, field: LeadField, value: string): FlowLead => {
  return {
    ...lead,
    [field]: value,
  };
};

const createBaseContext = (context: Partial<FlowContext> | undefined): FlowContext => {
  return {
    plan: context?.plan ?? "FREE",
    currentStepId: context?.currentStepId,
    messageCount: context?.messageCount ?? 0,
    completed: context?.completed ?? false,
    collectedLead: cloneLead(context?.collectedLead ?? {}),
  };
};

const appendResponse = (
  responses: EngineResponse[],
  stepId: string,
  text: string,
  context: FlowContext,
): void => {
  responses.push({ stepId, text });
  context.messageCount += 1;
};

const advanceToNextPrompt = (
  stepMap: Map<string, FlowStep>,
  startStepId: string | undefined,
  context: FlowContext,
  responses: EngineResponse[],
): string | undefined => {
  let currentStepId = startStepId;

  while (currentStepId) {
    const step = getStepById(stepMap, currentStepId);

    if (!isStepAllowedForPlan(step, context.plan)) {
      currentStepId = getNextAllowedStepId(stepMap, getRawNextStepId(step), context.plan);
      continue;
    }

    const limitReached = context.plan === "FREE" && context.messageCount >= FREE_MAX_MESSAGES;

    if (limitReached) {
      context.currentStepId = step.id;
      return step.id;
    }

    if (step.kind === "message") {
      appendResponse(responses, step.id, step.prompt, context);
      currentStepId = getNextAllowedStepId(stepMap, step.nextStepId, context.plan);
      continue;
    }

    if (step.kind === "menu") {
      appendResponse(responses, step.id, buildMenuPrompt(step, context.plan), context);
      context.currentStepId = step.id;
      return step.id;
    }

    appendResponse(responses, step.id, step.prompt, context);
    context.currentStepId = step.id;
    return step.id;
  }

  context.currentStepId = undefined;
  context.completed = isLeadComplete(context.collectedLead, context.plan);
  return undefined;
};

export const runFlowEngine = (
  inputContext: Partial<FlowContext> | undefined,
  userMessage: string,
  steps: FlowStep[],
): EngineOutput => {
  const stepMap = createStepMap(steps);
  const context = createBaseContext(inputContext);
  const responses: EngineResponse[] = [];

  if (steps.length === 0) {
    throw new Error("FlowStep[] cannot be empty.");
  }

  if (!context.currentStepId) {
    context.currentStepId = getFirstStep(steps).id;
    advanceToNextPrompt(stepMap, context.currentStepId, context, responses);

    return {
      responses,
      nextContext: context,
      lead: context.completed ? cloneLead(context.collectedLead) : undefined,
    };
  }

  const activeStep = getStepById(stepMap, context.currentStepId);
  const trimmedMessage = normalizeText(userMessage);

  if (activeStep.kind === "menu") {
    const allowedOptions = toMenuOptions(activeStep, context.plan);
    const selectedOption =
      allowedOptions.find((option) => option.key === trimmedMessage) ??
      allowedOptions[Number.parseInt(trimmedMessage, 10) - 1] ??
      allowedOptions.find(
        (option) => option.label.toLowerCase() === trimmedMessage.toLowerCase(),
      );

    if (!selectedOption) {
      appendResponse(
        responses,
        activeStep.id,
        activeStep.invalidPrompt ?? DEFAULT_INVALID_MESSAGE,
        context,
      );

      if (!(context.plan === "FREE" && context.messageCount >= FREE_MAX_MESSAGES)) {
        appendResponse(responses, activeStep.id, buildMenuPrompt(activeStep, context.plan), context);
      }

      return {
        responses,
        nextContext: context,
        lead: context.completed ? cloneLead(context.collectedLead) : undefined,
      };
    }

    context.currentStepId = getNextAllowedStepId(stepMap, selectedOption.nextStepId, context.plan);
  } else if (activeStep.kind === "collect") {
    const collectedValue = validateFieldValue(activeStep, userMessage);

    if (!collectedValue) {
      appendResponse(
        responses,
        activeStep.id,
        activeStep.invalidPrompt ?? DEFAULT_INVALID_MESSAGE,
        context,
      );

      if (!(context.plan === "FREE" && context.messageCount >= FREE_MAX_MESSAGES)) {
        appendResponse(responses, activeStep.id, activeStep.prompt, context);
      }

      return {
        responses,
        nextContext: context,
        lead: context.completed ? cloneLead(context.collectedLead) : undefined,
      };
    }

    context.collectedLead = updateLeadField(context.collectedLead, activeStep.field, collectedValue);
    context.currentStepId = getNextAllowedStepId(stepMap, activeStep.nextStepId, context.plan);
  } else {
    context.currentStepId = getNextAllowedStepId(stepMap, activeStep.nextStepId, context.plan);
  }

  advanceToNextPrompt(stepMap, context.currentStepId, context, responses);

  return {
    responses,
    nextContext: context,
    lead: context.completed ? cloneLead(context.collectedLead) : undefined,
  };
};
