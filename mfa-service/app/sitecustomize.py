"""
VoiceAct hook for MFA's command-line workflow.

MFA exposes ``PretrainedAligner.get_phone_confidences()``, but the standard
``mfa align`` command does not call it before exporting the TextGrid. This
module is loaded only in the alignment subprocess through ``PYTHONPATH`` and
adds that missing public API call without duplicating MFA's CLI setup.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger("voiceact.mfa")


def _enable_phone_confidence_hook() -> None:
    if os.getenv("VOICEACT_MFA_PHONE_CONFIDENCE") != "1":
        return

    from montreal_forced_aligner.alignment import PretrainedAligner

    original = PretrainedAligner.analyze_alignments
    if getattr(original, "_voiceact_phone_confidence_hook", False):
        return

    def analyze_with_phone_confidence(self, *args, **kwargs):
        logger.info("VoiceAct is calculating MFA phone confidence evidence")
        self.get_phone_confidences()
        return original(self, *args, **kwargs)

    analyze_with_phone_confidence._voiceact_phone_confidence_hook = True
    PretrainedAligner.analyze_alignments = analyze_with_phone_confidence


_enable_phone_confidence_hook()
