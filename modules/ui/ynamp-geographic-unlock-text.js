function getGeographicUnlockCapitalPlotText() {
  return Locale.compose("LOC_YNAMP_GEOGRAPHIC_UNLOCK_WEIGHT_CAPITAL");
}

function getGeographicUnlockAreaText(ownedPercent = 0) {
  return Locale.compose("LOC_YNAMP_GEOGRAPHIC_UNLOCK_WEIGHT_AREA", Number(ownedPercent) || 0);
}

function buildGeographicUnlockWeightReason(candidateDetail) {
  if (!candidateDetail) {
    return null;
  }
  const labelParts = [];
  if (candidateDetail.ownsCapitalPlot) {
    labelParts.push(getGeographicUnlockCapitalPlotText());
  }
  labelParts.push(getGeographicUnlockAreaText(candidateDetail.ownedPercent ?? 0));
  return labelParts.join(" + ");
}

function buildGeographicUnlockCivilizationLabel(baseLabel, candidateDetail) {
  const reason = buildGeographicUnlockWeightReason(candidateDetail);
  if (!reason) {
    return baseLabel;
  }
  return `${baseLabel} (${reason})`;
}

function buildGeographicUnlockCivilizationName(baseLabel) {
  return baseLabel;
}

export {
  buildGeographicUnlockCivilizationName,
  buildGeographicUnlockCivilizationLabel,
  buildGeographicUnlockWeightReason,
  getGeographicUnlockAreaText,
  getGeographicUnlockCapitalPlotText
};