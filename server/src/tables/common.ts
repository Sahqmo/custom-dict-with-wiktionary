// 언어별 표 정의가 공유하는 작은 도구들
import type { Axis } from "./engine.js";

export const ax = (label: string, ...tags: string[]): Axis => ({ label, tags });
// 어미 강조에서 어간 대신 부정사를 기준으로 삼는 행 (스페인어/프랑스어 미래·조건법)
export const axInf = (label: string, ...tags: string[]): Axis => ({ label, tags, base: "inf" });

export const P1 = ["first-person"], P2 = ["second-person"], P3 = ["third-person"], SG = ["singular"], PL = ["plural"];
