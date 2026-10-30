"""
Loop Engineering State Machine
Tracks outer SDLC loops, inner cycle iterations, feedback history, and gate verdicts.
Enforces the 5 discrete SDLC Loops.
"""

import json
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import List, Optional, Dict, Any

class LoopStage(str, Enum):
    SPEC = "LOOP_1_SPECIFICATION"
    TDD = "LOOP_2_TDD_BUILD"
    SECURITY = "LOOP_3_SECURITY_VERIFICATION"
    UI = "LOOP_4_UI_INTEGRATION"
    PACKAGING = "LOOP_5_MARKETPLACE_PACKAGING"
    COMPLETE = "ALL_LOOPS_COMPLETE"

@dataclass
class CycleRecord:
    cycle_number: int
    stage: str
    timestamp: float
    action_summary: str
    evaluator_name: str
    passed: bool = False
    score: float = 0.0
    failures: List[str] = field(default_factory=list)
    feedback: str = ""

@dataclass
class LoopState:
    app_name: str
    current_stage: LoopStage = LoopStage.SPEC
    current_cycle: int = 1
    max_cycles_per_stage: int = 10
    stage_history: Dict[str, List[Dict[str, Any]]] = field(default_factory=lambda: {
        LoopStage.SPEC.value: [],
        LoopStage.TDD.value: [],
        LoopStage.SECURITY.value: [],
        LoopStage.UI.value: [],
        LoopStage.PACKAGING.value: []
    })
    is_halted: bool = False
    halt_reason: Optional[str] = None

    def record_cycle(self, stage: LoopStage, record: CycleRecord):
        if stage.value not in self.stage_history:
            self.stage_history[stage.value] = []
        self.stage_history[stage.value].append(asdict(record))
        self.current_cycle += 1

    def advance_stage(self, next_stage: LoopStage):
        self.current_stage = next_stage
        self.current_cycle = 1

    def save(self, filepath: Path):
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(asdict(self), f, indent=2)

    @classmethod
    def load(cls, filepath: Path) -> "LoopState":
        if not filepath.exists():
            return cls(app_name="ledgerseal")
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            data["current_stage"] = LoopStage(data["current_stage"])
            return cls(**data)
