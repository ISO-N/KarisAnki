import { describe, expectTypeOf, it } from "vitest";
import type { components } from "./api-contract";
import type {
  AnswerBatchItemRequest,
  AnswerBatchResponse,
  AnswerResponse,
  BootstrapResponse,
  Card,
  CardList,
  Deck,
  DeckOverview,
  ImportPreview,
  ImportResult,
  Queue,
  RegistrationStatus,
  Settings,
  Statistics,
  StudySession,
  User,
} from "./types";

type ContractSchemas = components["schemas"];
type contract = ContractSchemas;

describe("contract compatibility", () => {
  it("keeps manual response models assignable to generated contract models", () => {
    expectTypeOf<Settings>().toMatchTypeOf<contract["Settings"]>();
    expectTypeOf<User>().toMatchTypeOf<contract["User"]>();
    expectTypeOf<Deck>().toMatchTypeOf<contract["Deck"]>();
    expectTypeOf<Card>().toMatchTypeOf<contract["Card"]>();
    expectTypeOf<CardList>().toMatchTypeOf<contract["CardList"]>();
    expectTypeOf<DeckOverview>().toMatchTypeOf<contract["DeckOverview"]>();
    expectTypeOf<BootstrapResponse>().toMatchTypeOf<contract["Bootstrap"]>();
    expectTypeOf<Queue>().toMatchTypeOf<contract["Queue"]>();
    expectTypeOf<StudySession>().toMatchTypeOf<contract["Session"]>();
    expectTypeOf<AnswerResponse>().toMatchTypeOf<contract["AnswerResponse"]>();
    expectTypeOf<AnswerBatchResponse>().toMatchTypeOf<contract["AnswerBatchResponse"]>();
    expectTypeOf<AnswerBatchItemRequest>().toMatchTypeOf<contract["AnswerBatchItemRequest"]>();
    expectTypeOf<Statistics>().toMatchTypeOf<contract["Statistics"]>();
    expectTypeOf<ImportPreview>().toMatchTypeOf<contract["ImportPreview"]>();
    expectTypeOf<ImportResult>().toMatchTypeOf<contract["ImportResult"]>();
    expectTypeOf<RegistrationStatus>().toMatchTypeOf<contract["RegistrationStatus"]>();
  });

});
