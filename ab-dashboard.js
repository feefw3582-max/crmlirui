(function () {
  const SAMPLE_CSV = `ab_test_id,day,variant,grade,subject,uv,impressions,clicks,orders,gmv
AB-2026-03,2026-03-21,control,小学,数学,4200,8600,680,112,5200
AB-2026-03,2026-03-21,策略A,小学,数学,4280,8720,724,126,5880
AB-2026-03,2026-03-21,策略B,小学,数学,4300,8760,735,131,6060
AB-2026-03,2026-03-21,control,初中,英语,3880,8010,620,101,4890
AB-2026-03,2026-03-21,策略A,初中,英语,3960,8150,668,114,5510
AB-2026-03,2026-03-21,策略B,初中,英语,3990,8220,682,118,5690
AB-2026-03,2026-03-22,control,小学,数学,4260,8690,701,118,5480
AB-2026-03,2026-03-22,策略A,小学,数学,4340,8810,748,133,6180
AB-2026-03,2026-03-22,策略B,小学,数学,4370,8890,759,138,6390
AB-2026-03,2026-03-22,control,初中,英语,3920,8090,634,105,5030
AB-2026-03,2026-03-22,策略A,初中,英语,4010,8240,684,119,5720
AB-2026-03,2026-03-22,策略B,初中,英语,4040,8290,699,122,5880`;

  const CONTROL_VALUE_HINTS = /(control|baseline|base|holdout|reference|对照|基线|原始|默认|旧版|老版|^a$|^a组$|groupa)/i;
  const EXPERIMENT_VALUE_HINTS = /(experiment|test|variant|treatment|实验|策略|新版|^b$|^c$|^d$|^b组$|^c组$|groupb|groupc)/i;
  const EXPERIMENT_HEADER_HINTS = /(experimentid|experiment|abtest|expid|testid|实验id|实验编号|实验|试验)/i;
  const DATE_HEADER_HINTS = /(date|day|dt|time|日期|时间|天)/i;
  const GROUP_HEADER_HINTS = /(group|variant|bucket|arm|strategy|treatment|version|组别|组名|分组|实验组|版本|策略)/i;
  const GROUP_TYPE_HEADER_HINTS = /(grouptype|varianttype|类型|组类型|实验类型)/i;
  const ID_HEADER_HINTS = /(id|编号|编码|code|序号|no)$/i;
  const PERCENT_HEADER_HINTS = /(rate|ratio|ctr|cvr|roi|pct|percent|share|转化率|点击率|留存率|渗透率|占比|比率|比例|比值|率)/i;
  const PERCENT_RATIO_MULTIPLIER_HINTS = /(rate|ratio|ctr|cvr|roi|pct|percent|share|转化率|点击率|留存率|渗透率)/i;
  const METRIC_HEADER_HINTS = /(uv|dau|wau|mau|pv|gmv|revenue|income|sales|cost|profit|amount|amt|value|click|tap|hit|impression|show|view|exposure|order|pay|ctr|cvr|cv|arpu|arppu|retention|visitor|visitors|user|users|traffic|active|留存|转化|点击|曝光|展示|浏览|收入|收益|订单|成交|金额|成本|利润|人数|用户|活跃)/i;
  const DIMENSION_HEADER_HINTS = /(grade|subject|channel|city|province|region|country|gender|school|stage|class|product|sku|category|crowd|segment|source|terminal|device|network|scene|teacher|年级|学科|渠道|城市|省份|地区|国家|性别|学校|学段|班型|品类|商品|人群|来源|终端|设备|场景|老师)/i;

  const DERIVED_METRIC_RULES = [
    {
      id: "derived_conversion_rate",
      label: "转化率",
      concept: "conversion",
      numeratorHints: ["order", "orders", "ordercount", "purchase", "pay", "conversion", "订单", "成交", "转化"],
      denominatorHints: ["uv", "user", "users", "visitor", "visitors", "dau", "traffic", "用户", "访客", "活跃"],
      multiplier: 100,
      type: "percent"
    },
    {
      id: "derived_ctr",
      label: "点击率",
      concept: "ctr",
      numeratorHints: ["click", "clicks", "tap", "taps", "hit", "点击"],
      denominatorHints: ["impression", "impressions", "exposure", "show", "view", "pv", "曝光", "展示", "浏览"],
      multiplier: 100,
      type: "percent"
    },
    {
      id: "derived_arpu",
      label: "ARPU",
      concept: "arpu",
      numeratorHints: ["revenue", "gmv", "income", "sales", "tradeamt", "amount", "amt", "收益", "营收", "收入", "成交额"],
      denominatorHints: ["uv", "user", "users", "visitor", "visitors", "dau", "活跃", "用户", "访客"],
      multiplier: 1,
      type: "number"
    }
  ];
  const FORMULA_PRESET_LIBRARY = [
    { presetId: "preset_ctr", label: "点击率", type: "percent" },
    { presetId: "preset_conversion", label: "转化率", type: "percent" },
    { presetId: "preset_gmv", label: "GMV", type: "number" },
    { presetId: "preset_arpu", label: "ARPU", type: "number" },
    { presetId: "preset_confidence", label: "置信度", type: "number" }
  ];

  const SERIES_COLORS = ["#213547", "#0f9d8a", "#e85d4d", "#ff9f1c", "#1d4ed8", "#b83280", "#2f855a", "#6f42c1"];
  const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
  const numberFormatter = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const integerFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });

  const dom = {
    appRoot: document.getElementById("appRoot"),
    fileInput: document.getElementById("fileInput"),
    loadSampleBtn: document.getElementById("loadSampleBtn"),
    exportPageBtn: document.getElementById("exportPageBtn"),
    exportSummaryBtn: document.getElementById("exportSummaryBtn"),
    exportTrendBtn: document.getElementById("exportTrendBtn"),
    statusGrid: document.getElementById("statusGrid"),
    messageArea: document.getElementById("messageArea"),
    dashboardArea: document.getElementById("dashboardArea"),
    footerMeta: document.getElementById("footerMeta")
  };

  const state = {
    rawRows: [],
    records: [],
    schema: null,
    warnings: [],
    error: "",
    loading: false,
    fileName: "",
    sourceLabel: "",
    sourceSheetName: "",
    lastSyncedAt: "",
    experimentQuery: "",
    dateRange: { start: "", end: "" },
    selectedControls: [],
    selectedExperiments: [],
    caliber: "summary",
    trendXAxis: "date",
    trendChartType: "line",
    trendZoomScale: 1,
    trendMetric: "",
    tableSort: { metricId: "", direction: "desc" },
    showLiftBadges: true,
    hiddenLiftRows: [],
    hiddenLiftColumns: [],
    breakdownField: "",
    breakdownFields: [],
    dimensionSelectedControls: [],
    dimensionSelectedExperiments: [],
    hiddenSummaryMetrics: [],
    hiddenDimensionMetrics: [],
    dimensionFilterFields: [],
    dimensionFilters: {},
    openDimensions: [],
    hiddenSeries: [],
    formulaOverrides: [],
    customMetricCounter: 1,
    fieldOverrides: {
      experimentField: "",
      dateField: "",
      groupField: "",
      groupTypeField: ""
    }
  };

  let trendChartRefreshFrame = 0;

  function setLoading(value) {
    state.loading = value;
    renderMessages();
  }

  async function loadSampleData() {
    setLoading(true);
    state.error = "";
    try {
      const file = new File([SAMPLE_CSV], "dynamic-sample.csv", {
        type: "text/csv",
        lastModified: Date.now()
      });
      await loadFile(file, "示例数据");
    } catch (error) {
      state.error = error && error.message ? error.message : "加载示例数据失败。";
    } finally {
      setLoading(false);
      render();
    }
  }

  async function loadFile(file, sourceLabel) {
    setLoading(true);
    state.error = "";
    try {
      const parsedFile = await parseDataFile(file);
      state.rawRows = parsedFile.rows;
      state.sourceSheetName = parsedFile.sheetName || "";
      state.fieldOverrides = {
        experimentField: "",
        dateField: "",
        groupField: "",
        groupTypeField: ""
      };
      state.formulaOverrides = [];
      state.dimensionFilters = {};
      state.dimensionFilterFields = [];
      state.trendZoomScale = 1;
      state.hiddenLiftRows = [];
      state.hiddenLiftColumns = [];
      rebuildFromRawRows();
      state.fileName = file.name;
      state.sourceLabel = sourceLabel;
      state.lastSyncedAt = new Date().toLocaleString("zh-CN");
    } catch (error) {
      state.error = error && error.message ? error.message : "文件解析失败，请检查数据格式。";
    } finally {
      setLoading(false);
      render();
    }
  }

  async function parseDataFile(file) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
      dense: true
    });
    const bestSheet = pickBestSheet(workbook);
    if (!bestSheet || !bestSheet.rows.length) {
      throw new Error("文件中未找到可读取的数据工作表。");
    }
    return {
      rows: bestSheet.rows,
      sheetName: bestSheet.name
    };
  }

  function rebuildFromRawRows() {
    const parsed = normalizeRows(state.rawRows, state.fieldOverrides, state.formulaOverrides);
    state.records = parsed.rows;
    state.schema = parsed.schema;
    state.warnings = parsed.warnings;
    normalizeState();
  }

  function normalizeRows(inputRows, overrides, formulaOverrides) {
    const schema = inferSchema(inputRows, overrides, formulaOverrides);
    const normalizedRows = [];
    const warnings = schema.warnings.slice();
    if (state.sourceSheetName && state.sourceSheetName !== "Sheet1") {
      warnings.unshift("已自动选择工作表「" + state.sourceSheetName + "」作为数据源。");
    }

    inputRows.forEach(function (row, index) {
      const record = normalizeRecord(row, schema);
      if (!record) {
        warnings.push("第 " + (index + 2) + " 行缺少关键分组或指标信息，已跳过。");
        return;
      }
      normalizedRows.push(record);
    });

    normalizedRows.sort(function (left, right) {
      const experimentCompare = collator.compare(left.experimentId, right.experimentId);
      if (experimentCompare !== 0) return experimentCompare;
      if (left.date !== right.date) return left.date.localeCompare(right.date);
      return collator.compare(left.groupName, right.groupName);
    });

    if (!normalizedRows.length) {
      throw new Error("没有解析到有效数据，请检查上传内容。");
    }

    return { rows: normalizedRows, schema: schema, warnings: warnings };
  }

  function inferSchema(rows, overrides, formulaOverrides) {
    if (!rows.length) {
      throw new Error("表格中没有数据。");
    }

    const columns = analyzeColumns(rows);
    const warnings = [];
    const experimentChoice = resolveColumnChoice(columns, overrides && overrides.experimentField, function (column) {
      let score = 0;
      if (EXPERIMENT_HEADER_HINTS.test(column.normalized)) score += 120;
      if (column.isIdLike) score += 18;
      if (column.uniqueCount > 1 && column.uniqueCount < rows.length) score += 8;
      return score;
    });
    const dateChoice = resolveColumnChoice(columns, overrides && overrides.dateField, function (column) {
      let score = 0;
      if (DATE_HEADER_HINTS.test(column.normalized)) score += 120;
      score += Math.round(column.dateRatio * 80);
      if (column.isIdLike) score -= 20;
      return score;
    });
    const groupTypeChoice = resolveColumnChoice(columns, overrides && overrides.groupTypeField, function (column) {
      let score = 0;
      if (GROUP_TYPE_HEADER_HINTS.test(column.normalized)) score += 120;
      if (looksLikeExplicitGroupType(column.sampleValues)) score += 50;
      return score;
    });
    const experimentField = experimentChoice.key;
    const dateField = dateChoice.key;
    const groupTypeField = groupTypeChoice.key;
    const groupChoice = resolveColumnChoice(columns, overrides && overrides.groupField, function (column) {
      if (column.key === experimentField || column.key === dateField || column.key === groupTypeField) return -999;
      let score = 0;
      const headerLooksLikeGroup = GROUP_HEADER_HINTS.test(column.normalized);
      if (headerLooksLikeGroup) score += 120;
      if (containsGroupHints(column.sampleValues)) score += 70;
      if (column.isCategoricalCandidate && column.uniqueCount <= 12) score += 24;
      score += scoreGroupCandidate(column, rows, experimentField, dateField);
      if (column.numericRatio >= 0.85 && !headerLooksLikeGroup) score -= 80;
      if (column.hasMetricHint) score -= 120;
      if (column.isIdLike) score -= 18;
      return score;
    });
    const groupField = groupChoice.key;

    if (!groupField) {
      throw new Error("没有识别到实验分组字段。请保证底表里至少有一列表示 control/test/策略/variant 等分组。");
    }

    const coreFields = [experimentField, dateField, groupField, groupTypeField].filter(Boolean);
    const baseMetrics = columns
      .filter(function (column) {
        return !coreFields.includes(column.key) && column.isMetricCandidate;
      })
      .map(function (column) {
        const isPercentMetric = isPercentMetricColumn(column);
        return {
          id: "base:" + column.normalized,
          key: column.key,
          label: column.label,
          normalized: column.normalized,
          source: "base",
          type: isPercentMetric ? "percent" : "number",
          concept: detectMetricConcept(column.normalized),
          multiplier: isPercentMetric ? detectPercentMultiplier(column) : 1
        };
      });

    if (!baseMetrics.length) {
      throw new Error("没有识别到统计指标列。请保证表里有数值型的 DAU / GMV / CTR / UV / 点击 / 收益 等字段。");
    }

    const dimensionFields = columns
      .filter(function (column) {
        if (coreFields.includes(column.key)) return false;
        if (baseMetrics.some(function (metric) { return metric.key === column.key; })) return false;
        if (column.nonEmptyRatio < 0.1) return false;
        if (/^未命名字段/i.test(column.label) && !column.hasDimensionHint) return false;
        return (column.isCategoricalCandidate || (column.isLowCardinalityNumeric && DIMENSION_HEADER_HINTS.test(column.normalized))) && !column.isIdLike;
      })
      .map(function (column) {
        return {
          id: "dimension:" + column.normalized,
          key: column.key,
          label: column.label,
          normalized: column.normalized
        };
      });

    const formulaMetricConfigs = buildFormulaMetricConfigs(baseMetrics, formulaOverrides || []);
    const formulaMetrics = inferFormulaMetrics(baseMetrics, formulaMetricConfigs);
    const metrics = baseMetrics.concat(formulaMetrics);
    const groupValues = getDistinctValues(rows, groupField);
    const inferredGroupTypes = inferGroupTypeMap(groupValues);

    if (!experimentField) {
      warnings.push("未发现明确实验字段，已将整份数据视为同一个实验。");
    }
    if (!dateField) {
      warnings.push("未发现日期字段，趋势图已自动关闭。");
    }
    if (inferredGroupTypes.warning && !groupTypeField) {
      warnings.push(inferredGroupTypes.warning);
    }
    if (!dimensionFields.length) {
      warnings.push("当前数据未识别出明显属性维度，将只展示总表和趋势图。");
    }

    return {
      experimentField: experimentField,
      dateField: dateField,
      groupField: groupField,
      groupTypeField: groupTypeField,
      roleChoices: {
        experimentField: experimentChoice,
        dateField: dateChoice,
        groupField: groupChoice,
        groupTypeField: groupTypeChoice
      },
      columns: columns,
      dimensionFields: dimensionFields,
      baseMetrics: baseMetrics,
      formulaMetricConfigs: formulaMetricConfigs,
      metrics: metrics,
      inferredGroupTypes: inferredGroupTypes.map,
      warnings: warnings
    };
  }

  function analyzeColumns(rows) {
    const keys = [];
    rows.forEach(function (row) {
      Object.keys(row).forEach(function (key) {
        if (!keys.includes(key)) keys.push(key);
      });
    });

    return keys.map(function (key) {
      const values = rows.map(function (row) { return row[key]; }).filter(isPresent);
      const stringValues = values.map(function (value) { return String(value).trim(); }).filter(Boolean);
      const uniqueValues = Array.from(new Set(stringValues));
      const numericValues = values.map(function (value) { return toNullableNumber(value); }).filter(function (value) { return Number.isFinite(value); });
      const numericCount = values.filter(isNumericCandidate).length;
      const dateCount = values.filter(function (value) { return isDateCandidate(value, key); }).length;
      const nonEmptyCount = values.length || 1;
      const nonEmptyRatio = values.length / Math.max(rows.length, 1);
      const normalized = normalizeHeader(key);
      const repeatedValueRatio = nonEmptyCount > 1 ? 1 - uniqueValues.length / nonEmptyCount : 0;
      const hasMetricHint = METRIC_HEADER_HINTS.test(normalized);
      const hasDimensionHint = DIMENSION_HEADER_HINTS.test(normalized);
      const lowCardinalityNumeric = numericCount / nonEmptyCount >= 0.85 && uniqueValues.length <= Math.min(24, Math.max(6, Math.floor(rows.length * 0.18)));
      const mostlyRatioValues = numericValues.length
        ? numericValues.filter(function (value) { return value >= 0 && value <= 1.2; }).length / numericValues.length >= 0.8
        : false;

      return {
        key: key,
        label: String(key),
        normalized: normalized,
        uniqueCount: uniqueValues.length,
        sampleValues: uniqueValues.slice(0, 8),
        numericRatio: numericCount / nonEmptyCount,
        dateRatio: dateCount / nonEmptyCount,
        isIdLike: ID_HEADER_HINTS.test(normalized),
        hasMetricHint: hasMetricHint,
        hasDimensionHint: hasDimensionHint,
        repeatedValueRatio: repeatedValueRatio,
        numericValues: numericValues,
        nonEmptyRatio: nonEmptyRatio,
        mostlyRatioValues: mostlyRatioValues,
        isLowCardinalityNumeric: lowCardinalityNumeric,
        isMetricCandidate: (
          numericCount / nonEmptyCount >= 0.85 &&
          nonEmptyRatio >= 0.08 &&
          !ID_HEADER_HINTS.test(normalized) &&
          (hasMetricHint || !lowCardinalityNumeric || PERCENT_HEADER_HINTS.test(normalized))
        ),
        isCategoricalCandidate: (
          (uniqueValues.length > 1 && uniqueValues.length <= Math.min(40, Math.max(10, Math.floor(rows.length * 0.65)))) ||
          (lowCardinalityNumeric && hasDimensionHint)
        )
      };
    });
  }

  function resolveColumnChoice(columns, overrideKey, scorer) {
    if (overrideKey) {
      const forced = columns.find(function (column) {
        return column.key === overrideKey;
      });
      return {
        key: forced ? forced.key : "",
        score: forced ? 999 : 0,
        source: forced ? "manual" : "auto"
      };
    }

    let best = null;
    let bestScore = 0;
    columns.forEach(function (column) {
      const score = scorer(column);
      if (score > bestScore) {
        bestScore = score;
        best = column.key;
      }
    });

    return {
      key: best,
      score: bestScore,
      source: "auto"
    };
  }

  function scoreGroupCandidate(column, rows, experimentField, dateField) {
    if (!column.isCategoricalCandidate) return 0;

    const scopeMap = {};
    rows.forEach(function (row) {
      const value = readValue(row, column.key);
      if (!value) return;
      const scopeKey = (experimentField ? readValue(row, experimentField) : "__all__") + "|" + (dateField ? normalizeDate(row[dateField]) : "__all__");
      scopeMap[scopeKey] = scopeMap[scopeKey] || new Set();
      scopeMap[scopeKey].add(value);
    });

    const scopes = Object.keys(scopeMap);
    if (!scopes.length) return 0;

    const distinctCounts = scopes.map(function (scopeKey) {
      return scopeMap[scopeKey].size;
    });
    const multiValueScopeRatio = distinctCounts.filter(function (count) { return count >= 2; }).length / scopes.length;
    const avgDistinctPerScope = distinctCounts.reduce(function (sum, count) { return sum + count; }, 0) / scopes.length;

    let score = 0;
    score += Math.round(multiValueScopeRatio * 50);
    score += Math.round(Math.min(avgDistinctPerScope, 8) * 4);
    if (column.uniqueCount >= 2 && column.uniqueCount <= 8) score += 18;
    if (column.hasDimensionHint) score -= 12;
    return score;
  }

  function detectPercentMultiplier(column) {
    if (!column) return 1;
    if ((column.sampleValues || []).some(function (value) { return /%/.test(String(value)); })) {
      return 1;
    }
    return column.mostlyRatioValues && PERCENT_RATIO_MULTIPLIER_HINTS.test(column.normalized) ? 100 : 1;
  }

  function isPercentMetricColumn(column) {
    if (!column) return false;
    if (PERCENT_HEADER_HINTS.test(column.normalized)) return true;
    if (column.mostlyRatioValues && /(share|ratio|rate|pct|percent|占比|比例|比值|率|转|留存|渗透)/i.test(column.normalized)) {
      return true;
    }
    return false;
  }

  function normalizeRecord(row, schema) {
    const groupName = readValue(row, schema.groupField);
    if (!groupName) return null;

    const baseMetrics = {};
    let hasMetricValue = false;
    schema.baseMetrics.forEach(function (metric) {
      const value = toNullableNumber(row[metric.key]);
      baseMetrics[metric.id] = value;
      if (value !== null) hasMetricValue = true;
    });
    if (!hasMetricValue) return null;

    const dimensions = {};
    schema.dimensionFields.forEach(function (field) {
      dimensions[field.id] = readValue(row, field.key) || "未标注";
    });

    let hasAggregateAllDimension = false;
    schema.dimensionFields.forEach(function (field) {
      if (!hasAggregateAllDimension && isExcludedAggregateDimensionValue(field, dimensions[field.id])) {
        hasAggregateAllDimension = true;
      }
    });
    if (hasAggregateAllDimension) return null;

    const explicitGroupType = schema.groupTypeField ? normalizeExplicitGroupType(readValue(row, schema.groupTypeField)) : null;
    const experimentId = schema.experimentField ? readValue(row, schema.experimentField) || "默认实验" : "默认实验";
    const date = schema.dateField ? normalizeDate(row[schema.dateField]) : "";

    return {
      experimentId: experimentId,
      date: date,
      groupName: groupName,
      groupType: explicitGroupType || schema.inferredGroupTypes[groupName] || "experiment",
      dimensions: dimensions,
      metrics: baseMetrics
    };
  }

  function buildFormulaMetricConfigs(baseMetrics, overrideConfigs) {
    const existingConfigs = Array.isArray(overrideConfigs) && overrideConfigs.length
      ? overrideConfigs.slice()
      : buildDefaultFormulaMetricConfigs(baseMetrics);
    const knownPresetIds = existingConfigs.map(function (config) { return config.presetId; }).filter(Boolean);

    FORMULA_PRESET_LIBRARY.forEach(function (preset) {
      if (knownPresetIds.includes(preset.presetId)) return;
      const defaultConfig = createPresetFormulaConfig(preset.presetId, baseMetrics);
      existingConfigs.push(defaultConfig);
    });

    return existingConfigs.map(function (config, index) {
      const normalized = normalizeFormulaConfig(config, baseMetrics, index);
      normalized.validation = validateFormulaMetricConfig(normalized, baseMetrics, existingConfigs);
      return normalized;
    });
  }

  function buildDefaultFormulaMetricConfigs(baseMetrics) {
    return FORMULA_PRESET_LIBRARY.map(function (preset) {
      const config = createPresetFormulaConfig(preset.presetId, baseMetrics);
      if (preset.presetId === "preset_confidence") {
        config.selected = false;
      }
      return config;
    });
  }

  function createPresetFormulaConfig(presetId, baseMetrics) {
    const preset = FORMULA_PRESET_LIBRARY.find(function (item) { return item.presetId === presetId; });
    const label = preset ? preset.label : "自定义统计量";
    const type = preset ? preset.type : "number";
    return {
      id: presetId,
      presetId: presetId,
      label: label,
      type: type,
      formula: getDefaultFormulaForPreset(presetId, baseMetrics),
      compareToControl: false,
      selected: presetId !== "preset_confidence",
      isCustom: false
    };
  }

  function normalizeFormulaConfig(config, baseMetrics, index) {
    return {
      id: config.id || ("custom_formula_" + index),
      presetId: config.presetId || "",
      label: config.label || ("自定义统计量" + (index + 1)),
      type: config.type === "percent" ? "percent" : "number",
      formula: String(config.formula || "").trim(),
      compareToControl: Boolean(config.compareToControl),
      selected: config.selected !== false,
      isCustom: Boolean(config.isCustom),
      order: Number.isFinite(config.order) ? config.order : index
    };
  }

  function getDefaultFormulaForPreset(presetId, baseMetrics) {
    const orderMetric = pickMetricByHints(baseMetrics, ["order", "orders", "ordercount", "purchase", "pay", "订单", "成交", "转化"]);
    const uvMetric = pickMetricByHints(baseMetrics, ["uv", "user", "users", "visitor", "visitors", "dau", "traffic", "用户", "访客", "活跃"]);
    const clickMetric = pickMetricByHints(baseMetrics, ["click", "clicks", "tap", "taps", "hit", "点击"]);
    const exposureMetric = pickMetricByHints(baseMetrics, ["impression", "impressions", "exposure", "show", "view", "pv", "曝光", "展示", "浏览"]);
    const revenueMetric = pickMetricByHints(baseMetrics, ["revenue", "gmv", "income", "sales", "tradeamt", "amount", "amt", "收益", "营收", "收入", "成交额"]);

    if (presetId === "preset_ctr" && clickMetric && exposureMetric) {
      return "{" + clickMetric.label + "} / {" + exposureMetric.label + "} * 100";
    }
    if (presetId === "preset_conversion" && orderMetric && uvMetric) {
      return "{" + orderMetric.label + "} / {" + uvMetric.label + "} * 100";
    }
    if (presetId === "preset_gmv" && revenueMetric) {
      return "{" + revenueMetric.label + "}";
    }
    if (presetId === "preset_arpu" && revenueMetric && uvMetric) {
      return "{" + revenueMetric.label + "} / {" + uvMetric.label + "}";
    }
    if (presetId === "preset_confidence") {
      return "";
    }
    return "";
  }

  function inferFormulaMetrics(baseMetrics, formulaConfigs) {
    return formulaConfigs.filter(function (config) {
      return config.selected;
    }).map(function (config) {
      return {
        id: config.id,
        label: config.label,
        type: config.type,
        source: "formula",
        formula: config.formula,
        validation: config.validation,
        presetId: config.presetId,
        isCustom: config.isCustom,
        compareToControl: Boolean(config.compareToControl)
      };
    });
  }

  function validateFormulaMetricConfig(config, baseMetrics, formulaConfigs) {
    const warnings = [];
    if (!config.formula) {
      warnings.push("还没有填写公式。");
    }

    extractFormulaVariables(config.formula).forEach(function (variableName) {
      if (!resolveMetricReferenceByName(baseMetrics, formulaConfigs, variableName, config.id)) {
        warnings.push("缺少变量：" + variableName);
      }
    });

    extractVLookupCalls(config.formula).forEach(function (call) {
      if (call.args.length < 3) {
        warnings.push("VLOOKUP 需要 3 个参数。");
        return;
      }
      if (!call.args[0]) warnings.push("VLOOKUP 缺少查找字段。");
      if (!call.args[2]) warnings.push("VLOOKUP 缺少返回指标。");
    });

    return {
      valid: warnings.length === 0,
      warnings: warnings
    };
  }

  function pickBestSheet(workbook) {
    return workbook.SheetNames
      .map(function (name) {
        return parseSheetToRows(name, workbook.Sheets[name]);
      })
      .sort(function (left, right) {
        return right.score - left.score;
      })[0];
  }

  function parseSheetToRows(name, worksheet) {
    if (!worksheet) return { name: name, rows: [], score: 0 };
    const matrix = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: false
    });
    const rows = matrix
      .map(trimTrailingEmptyCells)
      .filter(function (row) {
        return row.some(function (cell) { return String(cell || "").trim() !== ""; });
      });

    if (!rows.length) return { name: name, rows: [], score: 0 };

    const headerRowIndex = detectHeaderRow(rows);
    const headerRow = rows[headerRowIndex] || [];
    const dataRows = rows.slice(headerRowIndex + 1);
    const headers = buildHeaders(headerRow, dataRows);
    const objectRows = dataRows
      .map(function (row) {
        const result = {};
        headers.forEach(function (header, index) {
          if (!header) return;
          result[header] = row[index] == null ? "" : row[index];
        });
        return result;
      })
      .filter(function (row) {
        return Object.values(row).some(function (value) {
          return String(value || "").trim() !== "";
        });
      });

    const headerCount = headers.filter(Boolean).length;
    return {
      name: name,
      rows: objectRows,
      score: objectRows.length * Math.max(headerCount, 1)
    };
  }

  function detectHeaderRow(rows) {
    let bestIndex = 0;
    let bestScore = -1;
    const limit = Math.min(rows.length, 8);

    for (let index = 0; index < limit; index += 1) {
      const row = rows[index];
      const nonEmpty = row.filter(function (cell) {
        return String(cell || "").trim() !== "";
      });
      const textLikeCount = nonEmpty.filter(function (cell) {
        return !isNumericCandidate(cell) || isDateCandidate(cell, "");
      }).length;
      const score = nonEmpty.length * 10 + textLikeCount * 4 - index;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    return bestIndex;
  }

  function buildHeaders(headerRow, dataRows) {
    const headers = [];
    const used = {};
    const maxLength = Math.max.apply(null, [headerRow.length].concat(dataRows.map(function (row) { return row.length; })));
    let unnamedCount = 0;

    for (let index = 0; index < maxLength; index += 1) {
      const rawHeader = String(headerRow[index] == null ? "" : headerRow[index]).trim();
      const hasData = dataRows.some(function (row) {
        return String(row[index] == null ? "" : row[index]).trim() !== "";
      });
      if (!rawHeader && !hasData) {
        headers.push("");
        continue;
      }
      let header = rawHeader;
      if (!header) {
        unnamedCount += 1;
        header = "未命名字段" + unnamedCount;
      }
      header = dedupeHeader(header, used);
      headers.push(header);
    }

    return headers;
  }

  function dedupeHeader(header, used) {
    if (!used[header]) {
      used[header] = 1;
      return header;
    }
    used[header] += 1;
    return header + "_" + used[header];
  }

  function trimTrailingEmptyCells(row) {
    const copy = row.slice();
    while (copy.length && String(copy[copy.length - 1] || "").trim() === "") {
      copy.pop();
    }
    return copy;
  }

  function pickBestColumn(columns, scorer) {
    let best = null;
    let bestScore = 0;
    columns.forEach(function (column) {
      const score = scorer(column);
      if (score > bestScore) {
        bestScore = score;
        best = column.key;
      }
    });
    return best;
  }

  function pickMetricByHints(metrics, hints) {
    let best = null;
    let bestScore = 0;
    metrics.forEach(function (metric) {
      const score = hints.reduce(function (accumulator, hint) {
        return accumulator + (metric.normalized.includes(hint) ? 1 : 0);
      }, 0);
      if (score > bestScore) {
        bestScore = score;
        best = metric;
      }
    });
    return best;
  }

  function extractFormulaVariables(formula) {
    const matches = [];
    String(formula || "").replace(/\{([^}]+)\}/g, function (_, variableName) {
      matches.push(String(variableName).trim());
      return _;
    });
    return matches;
  }

  function extractVLookupCalls(formula) {
    const calls = [];
    String(formula || "").replace(/VLOOKUP\s*\(([^)]*)\)/gi, function (_, argsText) {
      const args = splitFormulaArgs(argsText).map(stripFormulaQuotes);
      calls.push({ args: args });
      return _;
    });
    return calls;
  }

  function splitFormulaArgs(argsText) {
    return String(argsText || "")
      .split(",")
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }

  function stripFormulaQuotes(value) {
    const raw = String(value || "").trim();
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1);
    }
    return raw;
  }

  function resolveMetricReferenceByName(baseMetrics, formulaConfigs, referenceName, currentFormulaId) {
    const normalizedReference = normalizeHeader(referenceName);
    const baseMetric = baseMetrics.find(function (metric) {
      return metric.id === referenceName || metric.label === referenceName || metric.normalized === normalizedReference;
    });
    if (baseMetric) return baseMetric;

    const formulaMetric = formulaConfigs.find(function (config) {
      return config.id !== currentFormulaId &&
        config.selected &&
        (config.id === referenceName || config.label === referenceName || normalizeHeader(config.label) === normalizedReference);
    });
    return formulaMetric || null;
  }

  function inferGroupTypeMap(groupValues) {
    const sortedValues = groupValues.slice().sort(collator.compare);
    const map = {};
    let warning = "";

    sortedValues.forEach(function (value) {
      if (CONTROL_VALUE_HINTS.test(value)) map[value] = "control";
      if (EXPERIMENT_VALUE_HINTS.test(value)) map[value] = "experiment";
    });

    if (!sortedValues.some(function (value) { return map[value] === "control"; }) && sortedValues.length) {
      map[sortedValues[0]] = "control";
      warning = "未识别到显式对照组，已默认将“" + sortedValues[0] + "”视为对照组。";
    }

    sortedValues.forEach(function (value) {
      if (!map[value]) map[value] = "experiment";
    });

    return { map: map, warning: warning };
  }

  function getDistinctValues(rows, field) {
    return Array.from(new Set(rows.map(function (row) {
      return readValue(row, field);
    }).filter(Boolean)));
  }

  function normalizeState() {
    const schema = state.schema;
    if (!schema || !state.records.length) {
      state.experimentQuery = "";
      state.dateRange = { start: "", end: "" };
      state.selectedControls = [];
      state.selectedExperiments = [];
      state.dimensionSelectedControls = [];
      state.dimensionSelectedExperiments = [];
      state.breakdownField = "";
      state.breakdownFields = [];
      state.dimensionFilterFields = [];
      state.hiddenSummaryMetrics = [];
      state.hiddenDimensionMetrics = [];
      state.dimensionFilters = {};
      state.openDimensions = [];
      state.hiddenSeries = [];
      state.trendXAxis = "date";
      state.trendChartType = "line";
      state.trendZoomScale = 1;
      state.trendMetric = "";
      state.tableSort = { metricId: "", direction: "desc" };
      return;
    }

    const experimentIds = getExperimentIds(state.records);
    if (!state.experimentQuery || !filterExperimentIds(experimentIds, state.experimentQuery).length) {
      state.experimentQuery = experimentIds[0];
    }

    state.breakdownFields = state.breakdownFields.filter(function (fieldId, index, array) {
      return array.indexOf(fieldId) === index && schema.dimensionFields.some(function (field) { return field.id === fieldId; });
    });
    if (!state.breakdownFields.length && schema.dimensionFields.length) {
      state.breakdownFields = [schema.dimensionFields[0].id];
    }
    state.breakdownField = state.breakdownFields[0] || "";

    const resolvedExperimentId = resolveExperimentId(experimentIds, state.experimentQuery);
    const scope = getExperimentScope(state.records, resolvedExperimentId);
    if (!scope) return;

    if (schema.dateField) {
      state.dateRange = clampDateRange(state.dateRange.start, state.dateRange.end, scope.minDate, scope.maxDate);
    } else {
      state.dateRange = { start: "", end: "" };
    }

    const nextControls = state.selectedControls.filter(function (group) {
      return scope.allGroups.includes(group);
    }).slice(0, 3);
    const nextExperiments = state.selectedExperiments.filter(function (group) {
      return scope.allGroups.includes(group) && !nextControls.includes(group);
    }).slice(0, 7);

    const defaultControls = scope.controlGroups.length
      ? scope.controlGroups.slice(0, Math.min(2, scope.controlGroups.length))
      : scope.allGroups.slice(0, 1);
    const defaultExperiments = scope.experimentGroups.length
      ? scope.experimentGroups.filter(function (group) { return !defaultControls.includes(group); }).slice(0, Math.min(7, scope.experimentGroups.length))
      : scope.allGroups.filter(function (group) { return !defaultControls.includes(group); }).slice(0, 7);

    state.selectedControls = nextControls.length ? nextControls : defaultControls;
    state.selectedExperiments = nextExperiments.length ? nextExperiments : defaultExperiments;
    state.dimensionSelectedControls = state.dimensionSelectedControls.filter(function (group) {
      return scope.allGroups.includes(group);
    }).slice(0, 3);
    state.dimensionSelectedExperiments = state.dimensionSelectedExperiments.filter(function (group) {
      return scope.allGroups.includes(group) && !state.dimensionSelectedControls.includes(group);
    }).slice(0, 7);
    if (!state.dimensionSelectedControls.length) {
      state.dimensionSelectedControls = state.selectedControls.slice(0, 3);
    }
    if (!state.dimensionSelectedExperiments.length) {
      state.dimensionSelectedExperiments = state.selectedExperiments.filter(function (group) {
        return !state.dimensionSelectedControls.includes(group);
      }).slice(0, 7);
    }

    schema.dimensionFields.forEach(function (field) {
      const allowed = unique(scope.rows.map(function (row) {
        return row.dimensions[field.id] || "未标注";
      }));
      const selected = state.dimensionFilters[field.id] || [];
      state.dimensionFilters[field.id] = selected.filter(function (value) {
        return allowed.includes(value);
      });
    });
    state.dimensionFilterFields = state.dimensionFilterFields.filter(function (fieldId) {
      return schema.dimensionFields.some(function (field) { return field.id === fieldId; });
    });
    if (!state.dimensionFilterFields.length) {
      state.dimensionFilterFields = schema.dimensionFields.map(function (field) { return field.id; }).slice(0, Math.min(3, schema.dimensionFields.length));
    }

    const nextMetricIds = schema.metrics.map(function (metric) { return metric.id; });
    state.hiddenSummaryMetrics = state.hiddenSummaryMetrics.filter(function (metricId) {
      return nextMetricIds.includes(metricId);
    });
    state.hiddenDimensionMetrics = state.hiddenDimensionMetrics.filter(function (metricId) {
      return nextMetricIds.includes(metricId);
    });
    if (!state.trendMetric || !nextMetricIds.includes(state.trendMetric)) {
      state.trendMetric = nextMetricIds[0] || "";
    }
    const nextXAxisIds = getTrendXAxisOptions(schema).map(function (item) { return item.id; });
    if (!state.trendXAxis || !nextXAxisIds.includes(state.trendXAxis)) {
      state.trendXAxis = nextXAxisIds[0] || "date";
    }
    if (!["line", "bar", "pie"].includes(state.trendChartType)) {
      state.trendChartType = "line";
    }
    state.trendZoomScale = clampTrendZoomScale(state.trendZoomScale);
    if (!state.tableSort.metricId || !nextMetricIds.includes(state.tableSort.metricId)) {
      state.tableSort.metricId = nextMetricIds[0] || "";
      state.tableSort.direction = "desc";
    }
    state.formulaOverrides = schema.formulaMetricConfigs || state.formulaOverrides;
    state.customMetricCounter = Math.max(state.customMetricCounter, state.formulaOverrides.length + 1);

    state.openDimensions = state.openDimensions.filter(Boolean);
  }

  function getExperimentIds(rows) {
    return unique(rows.map(function (row) {
      return row.experimentId;
    }));
  }

  function filterExperimentIds(experimentIds, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return experimentIds;
    return experimentIds.filter(function (experimentId) {
      return experimentId.toLowerCase().includes(normalizedQuery);
    });
  }

  function resolveExperimentId(experimentIds, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return experimentIds[0] || "";
    const exactMatch = experimentIds.find(function (experimentId) {
      return experimentId.toLowerCase() === normalizedQuery;
    });
    if (exactMatch) return exactMatch;
    return filterExperimentIds(experimentIds, query)[0] || "";
  }

  function getExperimentScope(rows, experimentId) {
    if (!experimentId) return null;
    const filtered = rows.filter(function (row) {
      return row.experimentId === experimentId;
    });
    if (!filtered.length) return null;

    const schema = state.schema;
    const dates = schema && schema.dateField
      ? unique(filtered.map(function (row) { return row.date; })).sort()
      : [];
    const allGroups = unique(filtered.map(function (row) { return row.groupName; }));
    const controlGroups = unique(filtered.filter(function (row) { return row.groupType === "control"; }).map(function (row) { return row.groupName; }));
    const experimentGroups = unique(filtered.filter(function (row) { return row.groupType === "experiment"; }).map(function (row) { return row.groupName; }));

    return {
      experimentId: experimentId,
      rows: filtered,
      minDate: dates[0] || "",
      maxDate: dates[dates.length - 1] || "",
      allGroups: allGroups,
      controlGroups: controlGroups,
      experimentGroups: experimentGroups
    };
  }

  function filterRowsByDateRange(rows, start, end) {
    return rows.filter(function (row) {
      return !start || !end || (row.date >= start && row.date <= end);
    });
  }

  function filterRowsByDimensionFilters(rows, dimensionFilters) {
    return rows.filter(function (row) {
      return Object.keys(dimensionFilters).every(function (fieldId) {
        const selectedValues = dimensionFilters[fieldId] || [];
        if (!selectedValues.length) return true;
        return selectedValues.includes(row.dimensions[fieldId] || "未标注");
      });
    });
  }

  function countDaysInclusive(start, end) {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return 1;
    return Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1);
  }

  function clampDateRange(start, end, minDate, maxDate) {
    const safeStart = start && start >= minDate && start <= maxDate ? start : minDate;
    const safeEnd = end && end >= safeStart && end <= maxDate ? end : maxDate;
    return { start: safeStart, end: safeEnd < safeStart ? safeStart : safeEnd };
  }

  function aggregateRows(rows, schema) {
    const totals = {};
    const counts = {};
    schema.baseMetrics.forEach(function (metric) {
      totals[metric.id] = 0;
      counts[metric.id] = 0;
    });
    rows.forEach(function (row) {
      schema.baseMetrics.forEach(function (metric) {
        if (Number.isFinite(row.metrics[metric.id])) {
          totals[metric.id] += row.metrics[metric.id];
          counts[metric.id] += 1;
        }
      });
    });
    return {
      totals: totals,
      counts: counts,
      hasData: rows.length > 0,
      rowCount: rows.length
    };
  }

  function applyCaliber(baseBundle, caliber, days) {
    if (!baseBundle.hasData || caliber === "summary") return baseBundle;
    const next = {};
    Object.keys(baseBundle.totals).forEach(function (key) {
      next[key] = baseBundle.totals[key] / Math.max(days, 1);
    });
    return {
      totals: next,
      counts: baseBundle.counts,
      hasData: baseBundle.hasData,
      rowCount: baseBundle.rowCount
    };
  }

  function calculateMetricValue(metric, baseBundle) {
    if (!baseBundle || !baseBundle.hasData) return null;
    if (metric.source !== "base") return null;
    if (!baseBundle.counts[metric.id]) return null;
    const value = baseBundle.totals[metric.id];
    return Number.isFinite(value) ? value * (metric.multiplier || 1) : null;
  }

  function computeMetricValues(schema, baseBundle, contextRows) {
    const values = {};
    const cache = {};

    schema.metrics.forEach(function (metric) {
      values[metric.id] = computeMetricValueById(metric.id, schema, baseBundle, contextRows, values, cache, []);
    });

    return values;
  }

  function computeMetricValueById(metricId, schema, baseBundle, contextRows, values, cache, stack) {
    if (Object.prototype.hasOwnProperty.call(cache, metricId)) return cache[metricId];
    if (stack.includes(metricId)) return null;

    const metric = schema.metrics.find(function (item) { return item.id === metricId; });
    if (!metric) return null;

    let result = null;
    if (metric.source === "base") {
      result = calculateMetricValue(metric, baseBundle);
    } else if (metric.source === "formula") {
      result = evaluateFormulaMetric(metric, schema, baseBundle, contextRows, values, cache, stack.concat(metricId));
    }

    cache[metricId] = result;
    values[metricId] = result;
    return result;
  }

  function evaluateFormulaMetric(metric, schema, baseBundle, contextRows, values, cache, stack) {
    if (!metric.formula || (metric.validation && !metric.validation.valid)) return null;

    const expression = String(metric.formula)
      .replace(/\{([^}]+)\}/g, function (_, variableName) {
        return 'GETVAR(' + JSON.stringify(String(variableName).trim()) + ')';
      })
      .replace(/VLOOKUP\s*\(/gi, "VLOOKUP(");

    try {
      const evaluator = new Function("GETVAR", "VLOOKUP", "return (" + expression + ");");
      const result = evaluator(
        function (variableName) {
          const target = resolveMetricReference(schema, variableName, metric.id);
          if (!target) return NaN;
          return computeMetricValueById(target.id, schema, baseBundle, contextRows, values, cache, stack);
        },
        function (fieldRef, matchValue, metricRef) {
          return evaluateVLookup(schema, contextRows, fieldRef, matchValue, metricRef);
        }
      );
      return Number.isFinite(result) ? result : null;
    } catch (error) {
      return null;
    }
  }

  function resolveMetricReference(schema, referenceName, currentMetricId) {
    const normalizedReference = normalizeHeader(referenceName);
    const baseMetric = schema.baseMetrics.find(function (metric) {
      return metric.id === referenceName || metric.label === referenceName || metric.normalized === normalizedReference;
    });
    if (baseMetric) return baseMetric;

    return schema.metrics.find(function (metric) {
      return metric.id !== currentMetricId &&
        metric.id !== undefined &&
        (metric.id === referenceName || metric.label === referenceName || normalizeHeader(metric.label) === normalizedReference);
    }) || null;
  }

  function evaluateVLookup(schema, contextRows, fieldRef, matchValue, metricRef) {
    const fieldResolver = resolveFieldReference(schema, fieldRef);
    if (!fieldResolver) return null;

    const subsetRows = contextRows.filter(function (row) {
      return fieldResolver(row) === String(matchValue == null ? "" : matchValue).trim();
    });
    if (!subsetRows.length) return null;

    const targetMetric = resolveMetricReference(schema, metricRef, "");
    if (!targetMetric) return null;

    const subsetBaseBundle = aggregateRows(subsetRows, schema);
    const subsetValues = {};
    const subsetCache = {};
    return computeMetricValueById(targetMetric.id, schema, subsetBaseBundle, subsetRows, subsetValues, subsetCache, []);
  }

  function resolveFieldReference(schema, fieldRef) {
    const normalizedField = normalizeHeader(fieldRef);
    if (normalizedField === "date" || normalizedField === normalizeHeader(schema.dateField || "")) {
      return function (row) { return row.date; };
    }
    if (normalizedField === "group" || normalizedField === "groupname" || normalizedField === normalizeHeader(schema.groupField || "")) {
      return function (row) { return row.groupName; };
    }
    if (normalizedField === "experiment" || normalizedField === normalizeHeader(schema.experimentField || "")) {
      return function (row) { return row.experimentId; };
    }
    const dimensionField = schema.dimensionFields.find(function (field) {
      return field.id === fieldRef || field.key === fieldRef || field.label === fieldRef || normalizeHeader(field.label) === normalizedField;
    });
    if (dimensionField) {
      return function (row) { return row.dimensions[dimensionField.id] || "未标注"; };
    }
    return null;
  }

  function buildComparisonRows(options) {
    const schema = options.schema;
    const rows = [];
    let mergedControl = null;

    if (options.selectedControls.length) {
      const controlRows = options.rows.filter(function (row) {
        return options.selectedControls.includes(row.groupName);
      });
      const mergedBase = buildMergedControlMetrics(options.rows, options.selectedControls, schema);
      mergedControl = createComparisonRow({
        key: "control_merged",
        label: "对照组均值",
        groupName: "对照组均值",
        groupType: "control",
        sourceGroups: mergedBase.sourceGroups,
        baseBundle: applyCaliber(mergedBase, options.caliber, options.days),
        contextRows: controlRows,
        controlReference: null,
        schema: schema
      });
      rows.push(mergedControl);
    }

    options.selectedExperiments.forEach(function (groupName) {
      const experimentRows = options.rows.filter(function (row) {
        return row.groupName === groupName;
      });
      const baseMetrics = aggregateRows(experimentRows, schema);
      rows.push(createComparisonRow({
        key: "experiment:" + groupName,
        label: groupName,
        groupName: groupName,
        groupType: "experiment",
        sourceGroups: [groupName],
        baseBundle: applyCaliber(baseMetrics, options.caliber, options.days),
        contextRows: experimentRows,
        controlReference: mergedControl,
        schema: schema
      }));
    });

    return rows;
  }

  function createComparisonRow(options) {
    const values = computeMetricValues(options.schema, options.baseBundle, options.contextRows || []);
    const lifts = {};
    options.schema.metrics.forEach(function (metric) {
      lifts[metric.id] = !options.controlReference || options.groupType === "control" || values[metric.id] === null
        ? null
        : calculateLift(values[metric.id], options.controlReference.values[metric.id]);
    });

    return {
      key: options.key,
      label: options.label,
      groupName: options.groupName,
      groupType: options.groupType,
      sourceGroups: options.sourceGroups,
      baseBundle: options.baseBundle,
      hasData: options.baseBundle.hasData,
      values: values,
      lifts: lifts
    };
  }

  function calculateLift(current, control) {
    if (!Number.isFinite(current) || !Number.isFinite(control) || control === 0) return null;
    return (current - control) / control * 100;
  }

  function buildMergedControlMetrics(rows, selectedControls, schema) {
    const bundles = selectedControls
      .map(function (groupName) {
        const baseBundle = aggregateRows(rows.filter(function (row) {
          return row.groupName === groupName;
        }), schema);
        return {
          groupName: groupName,
          baseBundle: baseBundle
        };
      })
      .filter(function (item) {
        return item.baseBundle.hasData;
      });

    if (!bundles.length) {
      return {
        totals: aggregateRows([], schema).totals,
        counts: aggregateRows([], schema).counts,
        hasData: false,
        rowCount: 0,
        sourceGroups: []
      };
    }

    const summed = bundles.reduce(function (accumulator, item) {
        schema.baseMetrics.forEach(function (metric) {
          accumulator.totals[metric.id] += item.baseBundle.totals[metric.id] || 0;
        });
        return accumulator;
      }, aggregateRows([], schema));

    const next = {};
    const counts = {};
    schema.baseMetrics.forEach(function (metric) {
      next[metric.id] = summed.totals[metric.id] / bundles.length;
      counts[metric.id] = bundles.reduce(function (sum, item) {
        return sum + (item.baseBundle.counts[metric.id] ? 1 : 0);
      }, 0);
    });
    return {
      totals: next,
      counts: counts,
      hasData: true,
      rowCount: bundles.reduce(function (sum, item) { return sum + item.baseBundle.rowCount; }, 0),
      sourceGroups: bundles.map(function (item) { return item.groupName; })
    };
  }

  function buildTrendData(options) {
    const schema = options.schema;
    const xFieldId = options.xFieldId || "date";
    if (xFieldId === "date" && !schema.dateField) return { data: [], seriesMeta: [], xFieldId: xFieldId, xValues: [] };

    const xValues = getSortedXAxisValues(options.rows, xFieldId);
    const seriesMeta = [];

    if (options.selectedControls.length) {
      seriesMeta.push({
        key: "control_merged",
        label: "对照组均值",
        groupType: "control",
        sourceGroups: options.selectedControls
      });
    }

    options.selectedExperiments.forEach(function (groupName) {
      seriesMeta.push({
        key: "experiment:" + groupName,
        label: groupName,
        groupType: "experiment",
        sourceGroups: [groupName]
      });
    });

    const data = xValues.map(function (xValue) {
      const point = { xValue: xValue };
      const xRows = options.rows.filter(function (row) {
        return getXAxisValue(row, xFieldId) === xValue;
      });
      let controlValues = null;

      if (options.selectedControls.length) {
        const controlRows = xRows.filter(function (row) {
          return options.selectedControls.includes(row.groupName);
        });
        const controlBase = buildMergedControlMetrics(xRows, options.selectedControls, schema);
        controlValues = computeMetricValues(schema, controlBase, controlRows);
        schema.metrics.forEach(function (metric) {
          point[getSeriesMetricKey("control_merged", metric.id)] = isCompareToControlMetric(metric)
            ? null
            : controlValues[metric.id];
        });
      }

      options.selectedExperiments.forEach(function (groupName) {
        const key = "experiment:" + groupName;
        const experimentRows = xRows.filter(function (row) {
          return row.groupName === groupName;
        });
        const baseMetrics = aggregateRows(experimentRows, schema);
        const experimentValues = computeMetricValues(schema, baseMetrics, experimentRows);
        schema.metrics.forEach(function (metric) {
          point[getSeriesMetricKey(key, metric.id)] = isCompareToControlMetric(metric)
            ? calculateLift(experimentValues[metric.id], controlValues ? controlValues[metric.id] : null)
            : experimentValues[metric.id];
        });
      });

      return point;
    });

    return {
      data: data,
      seriesMeta: seriesMeta,
      xFieldId: xFieldId,
      xValues: xValues
    };
  }

  function buildDimensionSections(options) {
    if (!options.dimensionFieldIds || !options.dimensionFieldIds.length) return [];
    const sectionMap = {};

    options.rows.forEach(function (row) {
      const parts = options.dimensionFieldIds.map(function (fieldId) {
        return {
          fieldId: fieldId,
          fieldLabel: getDimensionLabel(options.schema, fieldId),
          value: row.dimensions[fieldId] || "未标注"
        };
      });
      const sectionKey = buildDimensionSectionKey(parts);
      if (!sectionMap[sectionKey]) {
        sectionMap[sectionKey] = {
          key: sectionKey,
          parts: parts,
          label: parts.map(function (part) {
            return part.fieldLabel + "=" + part.value;
          }).join(" · "),
          rows: []
        };
      }
      sectionMap[sectionKey].rows.push(row);
    });

    return Object.keys(sectionMap).sort(collator.compare).map(function (sectionKey) {
      const section = sectionMap[sectionKey];
      return {
        key: section.key,
        label: section.label,
        rows: buildComparisonRows({
          rows: section.rows,
          selectedControls: options.selectedControls,
          selectedExperiments: options.selectedExperiments,
          caliber: options.caliber,
          days: options.days,
          schema: options.schema
        })
      };
    }).filter(function (section) {
      return section.rows.length > 0;
    });
  }

  function getSeriesMetricKey(seriesKey, metricId) {
    return seriesKey + "_" + metricId;
  }

  function getXAxisValue(row, xFieldId) {
    if (xFieldId === "date") return row.date;
    if (xFieldId === "group") return row.groupName;
    if (xFieldId === "experiment") return row.experimentId;
    return row.dimensions[xFieldId] || "未标注";
  }

  function getSortedXAxisValues(rows, xFieldId) {
    const values = unique(rows.map(function (row) {
      return getXAxisValue(row, xFieldId);
    }));

    if (xFieldId === "date") return values.sort();
    return values.sort(function (left, right) {
      if (left === "ALL") return -1;
      if (right === "ALL") return 1;
      if (left === "未标注") return 1;
      if (right === "未标注") return -1;
      return collator.compare(left, right);
    });
  }

  function buildDimensionSectionKey(parts) {
    return parts.map(function (part) {
      return part.fieldId + "::" + part.value;
    }).join("||");
  }

  function isExcludedAggregateDimensionValue(field, value) {
    if (!field || !value) return false;
    if (normalizeHeader(value) !== "all") return false;
    const fieldIdentity = [
      field.normalized,
      normalizeHeader(field.label || ""),
      normalizeHeader(field.key || ""),
      normalizeHeader(field.id || "")
    ].join("|");
    return /(grade|subject|年级|学科)/i.test(fieldIdentity);
  }

  function clampTrendZoomScale(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(10, Math.max(0.1, numeric));
  }

  function sliderValueToTrendZoomScale(rawValue) {
    const sliderValue = Math.min(100, Math.max(0, Number(rawValue)));
    if (sliderValue <= 50) {
      const ratio = sliderValue / 50;
      return Number((0.1 + ratio * 0.9).toFixed(2));
    }
    return Number((1 + ((sliderValue - 50) / 50) * 9).toFixed(2));
  }

  function trendZoomScaleToSliderValue(scale) {
    const safeScale = clampTrendZoomScale(scale);
    if (safeScale <= 1) {
      return Math.round(((safeScale - 0.1) / 0.9) * 50);
    }
    return Math.round(50 + ((safeScale - 1) / 9) * 50);
  }

  function formatTrendZoomScale(scale) {
    const safeScale = clampTrendZoomScale(scale);
    return safeScale >= 1 ? safeScale.toFixed(1) : safeScale.toFixed(2);
  }

  function computeScaledTrendDomain(domain, scale) {
    const baseMin = Number.isFinite(domain[0]) ? domain[0] : 0;
    const baseMax = Number.isFinite(domain[1]) ? domain[1] : 1;
    const safeScale = clampTrendZoomScale(scale);
    if (!(baseMax > baseMin)) {
      return [baseMin, baseMax === baseMin ? baseMin + 1 : baseMax];
    }
    if (safeScale === 1) {
      return [baseMin, baseMax];
    }
    if (safeScale > 1) {
      const nextMin = baseMax - (baseMax - baseMin) / safeScale;
      return [Number(nextMin.toFixed(6)), baseMax];
    }
    const expandedMax = baseMin + (baseMax - baseMin) / safeScale;
    return [baseMin, Number(expandedMax.toFixed(6))];
  }

  function computeYAxisDomain(data, visibleSeriesKeys, metricId) {
    const values = [];
    data.forEach(function (point) {
      visibleSeriesKeys.forEach(function (seriesKey) {
        const value = point[getSeriesMetricKey(seriesKey, metricId)];
        if (typeof value === "number" && Number.isFinite(value)) values.push(value);
      });
    });
    values.sort(function (left, right) { return left - right; });
    if (!values.length) return [0, 100];
    const min = values[0];
    const max = values[values.length - 1];
    const allBinaryish = values.every(function (value) {
      return value === 0 || value === 1;
    });
    if (allBinaryish) {
      return [0, 1];
    }
    if (min === max) {
      if (max === 0) return [0, 1];
      return [0, max];
    }
    const padding = (max - min) * 0.08;
    return [Math.max(0, min - padding), max + padding];
  }

  function collectTrendMetricValues(data, visibleSeriesKeys, metricId) {
    const values = [];
    data.forEach(function (point) {
      visibleSeriesKeys.forEach(function (seriesKey) {
        const value = point[getSeriesMetricKey(seriesKey, metricId)];
        if (typeof value === "number" && Number.isFinite(value)) values.push(value);
      });
    });
    return values.sort(function (left, right) { return left - right; });
  }

  function shouldUseFallbackYAxisTicks(values) {
    if (!values.length) return false;
    const min = values[0];
    const max = values[values.length - 1];
    if (min === max) return true;
    return values.every(function (value) {
      return value === 0 || value === 1;
    });
  }

  function buildFallbackYAxisTickValues(values, domain) {
    const tickCount = Math.max(2, arguments.length > 2 && Number.isFinite(arguments[2]) ? Math.round(arguments[2]) : 5);
    const min = Number.isFinite(domain && domain[0]) ? domain[0] : (values.length ? values[0] : 0);
    const max = Number.isFinite(domain && domain[1]) ? domain[1] : (values.length ? values[values.length - 1] : 1);
    const safeMax = max === min ? min + 1 : max;
    return Array.from({ length: tickCount }, function (_, index) {
      return Number((min + ((safeMax - min) * index) / (tickCount - 1)).toFixed(6));
    });
  }

  function projectTrendY(value, minY, maxY, padding, innerHeight) {
    const safeSpan = maxY - minY || 1;
    const ratio = (value - minY) / safeSpan;
    return padding.top + innerHeight - ratio * innerHeight;
  }

  function buildTrendYAxisTicks(domain, values, padding, innerHeight, tickCount) {
    const minY = domain[0];
    const maxY = domain[1];
    const safeSpan = maxY - minY || 1;
    const resolvedTickCount = Math.max(2, Number.isFinite(tickCount) ? Math.round(tickCount) : 5);
    const tickValues = shouldUseFallbackYAxisTicks(values)
      ? buildFallbackYAxisTickValues(values, domain, resolvedTickCount)
      : Array.from({ length: resolvedTickCount }, function (_, index) {
          const ratio = index / (resolvedTickCount - 1);
          return maxY - safeSpan * ratio;
        });
    return tickValues.map(function (value) {
      return {
        value: value,
        y: projectTrendY(value, minY, maxY, padding, innerHeight)
      };
    });
  }

  function computeTrendLineInnerHeight(scale) {
    const baseInnerHeight = 302;
    const safeScale = clampTrendZoomScale(scale);
    return Math.max(36, Math.round(baseInnerHeight * safeScale));
  }

  function computeTrendLineTickCount(innerHeight) {
    return Math.max(5, Math.min(20, Math.round(innerHeight / 80)));
  }

  function formatAxisMetricValue(metric, value) {
    if (!Number.isFinite(value)) return "--";
    const usePercent = metric && (metric.type === "percent" || isCompareToControlMetric(metric));
    const formatted = usePercent
      ? numberFormatter.format(value)
      : (Number.isInteger(value) ? integerFormatter.format(value) : numberFormatter.format(value));
    return usePercent ? formatted + "%" : formatted;
  }

  function detectMetricConcept(normalizedName) {
    if (normalizedName.includes("ctr") || normalizedName.includes("clickrate") || normalizedName.includes("点击率")) return "ctr";
    if (normalizedName.includes("arpu")) return "arpu";
    if (normalizedName.includes("conversion") || normalizedName.includes("cvr") || normalizedName.includes("cr") || normalizedName.includes("转化率")) return "conversion";
    return "base";
  }

  function containsGroupHints(values) {
    return values.some(function (value) {
      return CONTROL_VALUE_HINTS.test(value) || EXPERIMENT_VALUE_HINTS.test(value) || /^[a-d]组?$/i.test(value);
    });
  }

  function containsTypeHints(values) {
    return values.some(function (value) {
      return /(control|experiment|test|对照|实验)/i.test(value);
    });
  }

  function looksLikeExplicitGroupType(values) {
    if (!values.length) return false;
    return values.every(function (value) {
      return /^(control|experiment|test|对照|实验)$/i.test(String(value).trim());
    });
  }

  function normalizeExplicitGroupType(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (/(control|对照|基线|baseline)/i.test(normalized)) return "control";
    if (/(experiment|test|实验|策略|variant)/i.test(normalized)) return "experiment";
    return null;
  }

  function readValue(row, key) {
    return key ? String(row[key] == null ? "" : row[key]).trim() : "";
  }

  function normalizeHeader(value) {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "")
      .replace(/[（）()]/g, "");
  }

  function normalizeDate(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === "number") {
      const rawNumber = String(Math.trunc(value));
      if (/^\d{8}$/.test(rawNumber)) {
        return rawNumber.slice(0, 4) + "-" + rawNumber.slice(4, 6) + "-" + rawNumber.slice(6, 8);
      }
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed) return "";
      return String(parsed.y) + "-" + pad2(parsed.m) + "-" + pad2(parsed.d);
    }
    const raw = String(value).trim();
    if (!raw) return "";
    if (/^\d{8}$/.test(raw)) {
      return raw.slice(0, 4) + "-" + raw.slice(4, 6) + "-" + raw.slice(6, 8);
    }
    const normalized = raw.replace(/[./]/g, "-").replace(/\//g, "-");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  function toNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const raw = String(value == null ? "" : value).trim().replace(/,/g, "").replace(/%/g, "");
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function toNullableNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const raw = String(value == null ? "" : value).trim().replace(/,/g, "").replace(/%/g, "");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isNumericCandidate(value) {
    if (typeof value === "number") return Number.isFinite(value);
    const raw = String(value == null ? "" : value).trim().replace(/,/g, "").replace(/%/g, "");
    return raw !== "" && Number.isFinite(Number(raw));
  }

  function isDateCandidate(value, key) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
    if (typeof value === "number") {
      const rawNumber = String(Math.trunc(value));
      if (/^\d{8}$/.test(rawNumber)) return true;
      return DATE_HEADER_HINTS.test(normalizeHeader(key)) && value > 20000 && value < 60000;
    }
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return false;
    const normalizedKey = normalizeHeader(key);
    const looksLikeDate = /^(\d{8}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/.test(raw);
    if (!DATE_HEADER_HINTS.test(normalizedKey) && !looksLikeDate) return false;
    return !Number.isNaN(new Date(raw.replace(/[./]/g, "-")).getTime());
  }

  function isPresent(value) {
    if (value === undefined || value === null) return false;
    const raw = String(value).trim();
    return raw !== "" && !/^(null|n\/a|na|--|-)$/i.test(raw);
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean))).sort(collator.compare);
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatMetric(metric, value) {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    return metric.type === "percent" ? numberFormatter.format(value) + "%" : numberFormatter.format(value);
  }

  function formatLift(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return "基准";
    return (value > 0 ? "+" : "") + numberFormatter.format(value) + "%";
  }

  function isCompareToControlMetric(metric) {
    return Boolean(metric && metric.compareToControl);
  }

  function getMetricDisplayLabel(metric) {
    if (!metric) return "";
    return isCompareToControlMetric(metric) ? metric.label + "（绝对比值）" : metric.label;
  }

  function formatCompareMetric(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    return (value > 0 ? "+" : "") + numberFormatter.format(value) + "%";
  }

  function formatTrendMetric(metric, value) {
    if (isCompareToControlMetric(metric)) {
      return formatCompareMetric(value);
    }
    return formatMetric(metric, value);
  }

  function getComparisonMetricDisplayValue(metric, row) {
    if (isCompareToControlMetric(metric) && row.groupType === "experiment") {
      return row.lifts[metric.id];
    }
    return row.values[metric.id];
  }

  function getComparisonMetricSecondaryInfo(metric, row) {
    if (isCompareToControlMetric(metric) && row.groupType === "experiment") {
      if (row.values[metric.id] === null || row.values[metric.id] === undefined || Number.isNaN(row.values[metric.id])) {
        return null;
      }
      return {
        className: "base",
        text: "绝对值 " + formatMetric(metric, row.values[metric.id])
      };
    }
    const lift = row.lifts[metric.id];
    return {
      className: lift === null ? "base" : (lift >= 0 ? "positive" : "negative"),
      text: formatLift(lift)
    };
  }

  function cnDate(value) {
    if (!value) return "--";
    const parts = String(value).split("-");
    if (parts.length !== 3) return value;
    return parts[0] + "." + parts[1] + "." + parts[2];
  }

  function slugify(value) {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getVisibleMetrics(schema, hiddenMetricIds) {
    const hiddenSet = new Set(hiddenMetricIds || []);
    return schema.metrics.filter(function (metric) {
      return !hiddenSet.has(metric.id);
    });
  }

  function renderMetricVisibilityToolbar(schema, hiddenMetricIds, scopeKey, title) {
    const visibleCount = getVisibleMetrics(schema, hiddenMetricIds).length;
    return (
      '<div class="filter-block compact-block"><div class="filter-head"><strong>' + escapeHtml(title) + '</strong><span class="muted">' +
      escapeHtml(visibleCount ? ("当前显示 " + visibleCount + " 列") : "当前已隐藏全部统计列") +
      '</span></div><div class="pill-row">' +
      schema.metrics.map(function (metric) {
        const hidden = (hiddenMetricIds || []).includes(metric.id);
        return '<button type="button" class="pill metric-visibility-pill ' + (hidden ? "" : "selected control") + '" data-toggle-metric-visibility="' + escapeHtml(scopeKey) + '" data-metric-id="' + escapeHtml(metric.id) + '">' + escapeHtml(metric.label + (hidden ? " · 已隐藏" : " · 显示中")) + "</button>";
      }).join("") +
      "</div></div>"
    );
  }

  function toggleMetricVisibility(scopeKey, metricId, schema) {
    const stateKey = scopeKey === "dimension" ? "hiddenDimensionMetrics" : "hiddenSummaryMetrics";
    const current = state[stateKey] || [];
    if (current.includes(metricId)) {
      state[stateKey] = current.filter(function (item) { return item !== metricId; });
    } else {
      state[stateKey] = current.concat(metricId);
    }
    const visibleMetrics = getVisibleMetrics(schema, state[stateKey]);
    if (visibleMetrics.length && !visibleMetrics.some(function (metric) { return metric.id === state.tableSort.metricId; })) {
      state.tableSort.metricId = visibleMetrics[0].id;
      state.tableSort.direction = "desc";
    }
  }

  function getLiftRowToggleKey(tableId, rowKey) {
    return String(tableId || "") + "::row::" + String(rowKey || "");
  }

  function getLiftColumnToggleKey(tableId, metricId) {
    return String(tableId || "") + "::metric::" + String(metricId || "");
  }

  function isLiftRowVisible(tableId, rowKey) {
    return !state.hiddenLiftRows.includes(getLiftRowToggleKey(tableId, rowKey));
  }

  function isLiftColumnVisible(tableId, metricId) {
    return !state.hiddenLiftColumns.includes(getLiftColumnToggleKey(tableId, metricId));
  }

  function toggleLiftRowVisibility(tableId, rowKey) {
    const key = getLiftRowToggleKey(tableId, rowKey);
    if (state.hiddenLiftRows.includes(key)) {
      state.hiddenLiftRows = state.hiddenLiftRows.filter(function (item) { return item !== key; });
    } else {
      state.hiddenLiftRows = state.hiddenLiftRows.concat(key);
    }
  }

  function toggleLiftColumnVisibility(tableId, metricId) {
    const key = getLiftColumnToggleKey(tableId, metricId);
    if (state.hiddenLiftColumns.includes(key)) {
      state.hiddenLiftColumns = state.hiddenLiftColumns.filter(function (item) { return item !== key; });
    } else {
      state.hiddenLiftColumns = state.hiddenLiftColumns.concat(key);
    }
  }

  function shouldShowLiftBadge(tableId, rowKey, metricId, secondaryInfo) {
    return Boolean(
      state.showLiftBadges &&
      secondaryInfo &&
      isLiftRowVisible(tableId, rowKey) &&
      isLiftColumnVisible(tableId, metricId)
    );
  }

  function render() {
    normalizeState();
    renderStatus();
    renderMessages();
    renderDashboard();
  }

  function renderStatus() {
    const experimentIds = getExperimentIds(state.records);
    const resolvedExperimentId = resolveExperimentId(experimentIds, state.experimentQuery);
    const scope = getExperimentScope(state.records, resolvedExperimentId);
    const dateFilteredRows = scope && state.schema && state.schema.dateField
      ? filterRowsByDateRange(scope.rows, state.dateRange.start, state.dateRange.end)
      : (scope ? scope.rows : []);
    const filteredRows = scope ? filterRowsByDimensionFilters(dateFilteredRows, state.dimensionFilters) : [];
    const selectedDays = scope && state.schema && state.schema.dateField
      ? countDaysInclusive(state.dateRange.start, state.dateRange.end)
      : 0;

    const cards = [
      {
        icon: "源",
        label: "当前数据源",
        value: state.fileName || "尚未上传",
        note: (state.sourceLabel || "支持 .xlsx / .xls / .csv") + (state.sourceSheetName ? " · " + state.sourceSheetName : "")
      },
      {
        icon: "数",
        label: "数据规模",
        value: state.records.length ? state.records.length + " 行" : "0 行",
        note: state.records.length ? experimentIds.length + " 个实验" : "等待数据载入"
      },
      {
        icon: "构",
        label: "识别结果",
        value: state.schema ? state.schema.metrics.length + " 个指标" : "待识别",
        note: state.schema ? state.schema.dimensionFields.length + " 个维度" : "上传后自动识别"
      },
      {
        icon: "筛",
        label: "筛选结果",
        value: filteredRows.length ? filteredRows.length + " 行" : "暂无结果",
        note: state.schema && state.schema.dateField ? selectedDays + " 天时间窗" : "无日期字段时显示全量"
      }
    ];

    dom.statusGrid.innerHTML = cards.map(function (card) {
      return (
        '<article class="status-card"><div class="status-icon">' + card.icon + "</div><div><span>" +
        escapeHtml(card.label) + "</span><strong>" +
        escapeHtml(card.value) + "</strong><small>" +
        escapeHtml(card.note) + "</small></div></article>"
      );
    }).join("");
  }

  function renderMessages() {
    const blocks = [];
    if (state.warnings.length) {
      blocks.push(
        '<div class="message warning"><strong>自动识别提醒</strong><div>' +
        escapeHtml(state.warnings.slice(0, 4).join(" ")) +
        "</div></div>"
      );
    }
    if (state.error) {
      blocks.push(
        '<div class="message error"><strong>当前问题</strong><div>' +
        escapeHtml(state.error) +
        "</div></div>"
      );
    }
    if (state.loading) {
      blocks.push('<div class="message loading">正在识别字段角色、维度和指标...</div>');
    }
    dom.messageArea.innerHTML = blocks.join("");
  }

  function renderDashboard() {
    const schema = state.schema;
    const experimentIds = getExperimentIds(state.records);
    const matchedExperimentIds = filterExperimentIds(experimentIds, state.experimentQuery);
    const resolvedExperimentId = resolveExperimentId(experimentIds, state.experimentQuery);
    const scope = getExperimentScope(state.records, resolvedExperimentId);

    if (!schema || !scope) {
      dom.dashboardArea.innerHTML =
        '<section class="panel empty"><div><h2>上传底表后，这里会自动识别 schema</h2>' +
        '<p class="muted">我会尝试自动判断哪列是实验 ID、哪列是 group、哪些是属性维度、哪些是统计指标。</p></div></section>';
      dom.footerMeta.textContent = "等待数据载入";
      return;
    }

    const dateFilteredRows = schema.dateField
      ? filterRowsByDateRange(scope.rows, state.dateRange.start, state.dateRange.end)
      : scope.rows;
    const filteredRows = filterRowsByDimensionFilters(dateFilteredRows, state.dimensionFilters);
    const selectedDays = schema.dateField
      ? countDaysInclusive(state.dateRange.start, state.dateRange.end)
      : 1;

    const comparisonRows = buildComparisonRows({
      rows: filteredRows,
      selectedControls: state.selectedControls,
      selectedExperiments: state.selectedExperiments,
      caliber: state.caliber,
      days: selectedDays,
      schema: schema
    });

    const trendBundle = buildTrendData({
      rows: filteredRows,
      selectedControls: state.selectedControls,
      selectedExperiments: state.selectedExperiments,
      schema: schema,
      xFieldId: state.trendXAxis
    });

    const dimensionSections = buildDimensionSections({
      rows: filteredRows,
      selectedControls: state.dimensionSelectedControls,
      selectedExperiments: state.dimensionSelectedExperiments,
      caliber: state.caliber,
      days: selectedDays,
      schema: schema,
      dimensionFieldIds: state.breakdownFields
    });

    dom.footerMeta.textContent = schema.dimensionFields.length
      ? "当前拆解维度：" + state.breakdownFields.map(function (fieldId) { return getDimensionLabel(schema, fieldId); }).join(" / ")
      : "当前数据未识别出属性维度";

    const experimentHint = !state.experimentQuery
      ? ""
      : matchedExperimentIds.length
        ? state.experimentQuery === resolvedExperimentId
          ? "当前展示：" + resolvedExperimentId
          : "已匹配 " + matchedExperimentIds.length + " 个实验，当前展示：" + resolvedExperimentId
        : "未匹配到实验，请检查输入关键字。";

    dom.dashboardArea.innerHTML =
      renderFilterPanel(schema, scope, matchedExperimentIds, experimentHint, dateFilteredRows) +
      renderSummaryPanel(schema, comparisonRows, resolvedExperimentId, selectedDays) +
      renderTrendPanel(schema, trendBundle, comparisonRows) +
      renderDimensionPanel(schema, dimensionSections, scope);

    wireDashboardEvents(scope);
  }

  function renderFilterPanel(schema, scope, matchedExperimentIds, experimentHint, dateFilteredRows) {
    const hasManualOverrides = Object.keys(state.fieldOverrides).some(function (key) {
      return Boolean(state.fieldOverrides[key]);
    });

    return (
      '<section class="panel">' +
      '<div class="panel-head"><div><p class="eyebrow">智能识别</p><h2>字段角色与筛选器</h2>' +
      '<div class="subtitle">我会先自动推断字段角色；如果识别偏了，你也可以在下面直接纠偏，不用改原始列名。' +
      (hasManualOverrides ? " 当前已启用手动纠偏。" : "") +
      '</div></div><div class="button-row"><button class="button-ghost" type="button" id="resetRecognitionBtn">恢复自动识别</button></div></div>' +
      '<div class="recognition-grid">' +
      renderRecognitionCard("实验字段", schema.experimentField, schema.roleChoices.experimentField, getColumnSamples(schema, schema.experimentField)) +
      renderRecognitionCard("日期字段", schema.dateField, schema.roleChoices.dateField, getColumnSamples(schema, schema.dateField)) +
      renderRecognitionCard("分组字段", schema.groupField, schema.roleChoices.groupField, getColumnSamples(schema, schema.groupField)) +
      renderRecognitionCard("分组类型", schema.groupTypeField || "未指定", schema.roleChoices.groupTypeField, getColumnSamples(schema, schema.groupTypeField)) +
      renderRecognitionCard("维度字段", schema.dimensionFields.length + " 个", { source: "auto", score: schema.dimensionFields.length ? 90 : 0 }, schema.dimensionFields.map(function (field) { return field.label; }).slice(0, 4)) +
      renderRecognitionCard("指标字段", schema.metrics.length + " 个", { source: "auto", score: schema.metrics.length ? 90 : 0 }, schema.metrics.map(function (metric) { return metric.label; }).slice(0, 4)) +
      "</div>" +
      '<div class="recognition-editor">' +
      renderFieldSelect(schema, "experimentField", "实验字段", true) +
      renderFieldSelect(schema, "dateField", "日期字段", true) +
      renderFieldSelect(schema, "groupField", "分组字段", false) +
      renderFieldSelect(schema, "groupTypeField", "分组类型", true) +
      "</div>" +
      '<div class="message warning" style="margin-top:16px;margin-bottom:16px;"><strong>已识别 schema</strong><div>' +
      renderSchemaPills(schema) +
      "</div></div>" +
      renderColumnProfileTable(schema) +
      '<div class="filters-grid">' +
      '<label class="field"><span>实验</span>' +
      '<input id="experimentQueryInput" list="experimentIdOptions" value="' + escapeHtml(state.experimentQuery) + '" placeholder="输入实验编号或关键字" />' +
      (experimentHint ? '<small class="field-note' + (matchedExperimentIds.length ? "" : " error") + '">' + escapeHtml(experimentHint) + "</small>" : "") +
      '<datalist id="experimentIdOptions">' +
      matchedExperimentIds.map(function (id) {
        return '<option value="' + escapeHtml(id) + '"></option>';
      }).join("") +
      "</datalist></label>" +
      (schema.dateField
        ? '<label class="field"><span>开始日期</span><input id="startDateInput" type="date" min="' + escapeHtml(scope.minDate) + '" max="' + escapeHtml(state.dateRange.end || scope.maxDate) + '" value="' + escapeHtml(state.dateRange.start) + '" /></label>' +
          '<label class="field"><span>结束日期</span><input id="endDateInput" type="date" min="' + escapeHtml(state.dateRange.start || scope.minDate) + '" max="' + escapeHtml(scope.maxDate) + '" value="' + escapeHtml(state.dateRange.end) + '" /></label>'
        : '<div class="field"><span>日期字段</span><div class="field-note">未识别日期列，趋势图会自动隐藏。</div></div><div class="field"><span>日期筛选</span><div class="field-note">无日期字段时默认展示全量数据。</div></div>') +
      '<div class="field"><span>数据口径</span><div class="segment">' +
      renderSegmentButton("summary", "汇总数据", state.caliber) +
      renderSegmentButton("daily_avg", "日均数据", state.caliber) +
      "</div></div></div>" +
      renderDimensionFilterBlocks(schema, dateFilteredRows) +
      renderGroupSelectionEditor(scope) +
      renderFormulaEditor(schema) +
      "</section>"
    );
  }

  function renderDimensionFilterBlocks(schema, rows) {
    if (!schema.dimensionFields.length) return "";

    return (
      '<div class="filter-block"><div class="filter-head"><strong>维度值筛选</strong><span class="muted">像年级、学科、渠道这类字段都可以单独筛</span></div>' +
      schema.dimensionFields.map(function (field) {
        const values = unique(rows.map(function (row) {
          return row.dimensions[field.id] || "未标注";
        }));
        const selectedValues = state.dimensionFilters[field.id] || [];
        return (
          '<div class="dimension-filter-card"><div class="filter-head"><strong>' + escapeHtml(field.label) + '</strong><span class="muted">' +
          escapeHtml(selectedValues.length ? ("已选 " + selectedValues.length + " 项") : "默认全部") +
          '</span></div><div class="button-row">' +
          '<button type="button" class="button-ghost mini" data-dimension-select-all="' + field.id + '">全部</button>' +
          '<button type="button" class="button-ghost mini" data-dimension-clear="' + field.id + '">重置</button>' +
          "</div><div class=\"pill-row\">" +
          values.map(function (value) {
            return renderDimensionValuePill(field.id, value, selectedValues.includes(value));
          }).join("") +
          "</div></div>"
        );
      }).join("") +
      "</div>"
    );
  }

  function renderGroupSelectionEditor(scope) {
    return (
      '<div class="filter-block"><div class="filter-head"><strong>AB 组角色指定</strong><span class="muted">你可以直接输入组 ID，也可以点击下面的组标签</span></div>' +
      '<div class="group-editor-grid">' +
      '<label class="field"><span>对照组</span><textarea id="controlGroupsInput" rows="3" placeholder="例如：33782,33783">' + escapeHtml(state.selectedControls.join(", ")) + '</textarea><small class="field-note">至少 1 个，最多 3 个。多个对照组会先聚合基础指标，再重算转化率等复合指标。</small></label>' +
      '<label class="field"><span>实验组</span><textarea id="experimentGroupsInput" rows="3" placeholder="例如：110,108">' + escapeHtml(state.selectedExperiments.join(", ")) + '</textarea><small class="field-note">至少 1 个，最多 7 个。一个组不能同时属于对照组和实验组。</small></label>' +
      '</div><div class="button-row" style="margin-top:10px;"><button type="button" class="button-ghost" id="applyGroupSelectionBtn">应用组角色</button></div>' +
      '<div class="group-chooser"><div class="muted" style="margin-bottom:8px;">当前实验的全部分组</div><div class="pill-row">' +
      scope.allGroups.map(function (group) {
        return renderGroupChooserPill(group);
      }).join("") +
      "</div></div></div>"
    );
  }

  function renderFormulaEditor(schema) {
    const derivedMetrics = schema.metrics.filter(function (metric) {
      return metric.source === "derived";
    });
    if (!derivedMetrics.length) return "";

    return (
      '<div class="filter-block"><div class="filter-head"><strong>默认计算公式</strong><span class="muted">这些指标会按公式动态重算，你可以修改分子、分母和倍率</span></div>' +
      '<div class="formula-grid">' +
      derivedMetrics.map(function (metric) {
        return (
          '<article class="formula-card"><strong>' + escapeHtml(metric.label) + '</strong>' +
          '<label class="field"><span>分子</span><select data-formula-part="numerator" data-formula-id="' + metric.id + '">' +
          schema.baseMetrics.map(function (baseMetric) {
            return '<option value="' + baseMetric.id + '"' + (metric.numeratorId === baseMetric.id ? " selected" : "") + '>' + escapeHtml(baseMetric.label) + "</option>";
          }).join("") +
          '</select></label>' +
          '<label class="field"><span>分母</span><select data-formula-part="denominator" data-formula-id="' + metric.id + '">' +
          schema.baseMetrics.map(function (baseMetric) {
            return '<option value="' + baseMetric.id + '"' + (metric.denominatorId === baseMetric.id ? " selected" : "") + '>' + escapeHtml(baseMetric.label) + "</option>";
          }).join("") +
          '</select></label>' +
          '<label class="field"><span>倍率</span><input data-formula-part="multiplier" data-formula-id="' + metric.id + '" type="number" step="0.01" value="' + escapeHtml(metric.multiplier) + '" /></label>' +
          '<div class="field-note">当前：' + escapeHtml(metric.label) + " = " + escapeHtml(getMetricLabel(schema, metric.numeratorId)) + " / " + escapeHtml(getMetricLabel(schema, metric.denominatorId)) + " * " + escapeHtml(metric.multiplier) + "</div></article>"
        );
      }).join("") +
      '</div><div class="button-row" style="margin-top:10px;"><button type="button" class="button-ghost" id="applyFormulaBtn">应用公式</button></div></div>'
    );
  }

  function renderSummaryPanel(schema, comparisonRows, resolvedExperimentId, selectedDays) {
    const subtitle = resolvedExperimentId + " · " +
      (schema.dateField ? cnDate(state.dateRange.start) + " 至 " + cnDate(state.dateRange.end) + " · " : "") +
      (state.caliber === "summary" ? "汇总口径" : "日均口径（" + selectedDays + " 天）");

    return (
      '<section class="panel" id="summaryPanel">' +
      '<div class="panel-head"><div><p class="eyebrow">核心对比</p><h2>自动识别指标汇总表</h2><div class="subtitle">' +
      escapeHtml(subtitle) +
      '</div></div><div class="button-row"><span class="note">点击指标表头排序</span></div></div>' +
      renderMetricVisibilityToolbar(schema, state.hiddenSummaryMetrics, "summary", "核心对比列显示控制") +
      renderComparisonTable(schema, comparisonRows, {
        hiddenMetricIds: state.hiddenSummaryMetrics,
        tableId: "summary-comparison-table",
        exportFileName: "ab-summary-table",
        exportTitle: "Summary comparison table"
      }) +
      "</section>"
    );
  }

  function renderTrendPanel(schema, trendBundle, comparisonRows) {
    const xAxisOptions = getTrendXAxisOptions(schema);
    const zoomSliderValue = trendZoomScaleToSliderValue(state.trendZoomScale);
    const zoomDisabled = state.trendChartType === "pie";
    if (!xAxisOptions.length) {
      return (
        '<section class="panel" id="trendPanel"><div class="panel-head"><div><p class="eyebrow">趋势图表</p><h2>趋势与关系图</h2></div></div>' +
        '<div class="empty"><div><strong>当前没有可用于横轴的字段</strong><p class="muted">至少需要日期字段或属性维度字段，才能生成图表。</p></div></div></section>'
      );
    }

    const visibleSeriesKeys = trendBundle.seriesMeta
      .map(function (item) { return item.key; })
      .filter(function (key) { return !state.hiddenSeries.includes(key); });
    const trendInsights = buildTrendInsights(schema, trendBundle, comparisonRows, visibleSeriesKeys);

    return (
      '<section class="panel" id="trendPanel">' +
      '<div class="panel-head"><div><p class="eyebrow">趋势图表</p><h2>趋势与关系图</h2>' +
      '<div class="subtitle">现在可以自己选自变量和因变量，组别仍然会按当前全局 AB 选择进行对比。</div></div></div>' +
      '<div class="trend-config-grid">' +
      '<label class="field trend-scale-field"><span>Y 轴倍数</span><div class="trend-scale-card">' +
      '<div class="trend-scale-head"><strong id="trendZoomValue">×' + escapeHtml(formatTrendZoomScale(state.trendZoomScale)) + '</strong><small id="trendZoomHint">' + escapeHtml(zoomDisabled ? "饼图模式下不应用 Y 轴倍数" : "中点为 ×1，向右放大，向左缩小") + '</small></div>' +
      '<input id="trendZoomScaleInput" class="scale-slider" type="range" min="0" max="100" step="1" value="' + zoomSliderValue + '" style="--slider-progress:' + zoomSliderValue + '%;"' + (zoomDisabled ? " disabled" : "") + ' />' +
      '<div class="scale-label-row"><span>×0.10</span><span>×1.0</span><span>×10</span></div>' +
      "</div></label>" +
      '<label class="field"><span>自变量（X 轴）</span><select id="trendXAxisSelect">' +
      xAxisOptions.map(function (option) {
        return '<option value="' + escapeHtml(option.id) + '"' + (state.trendXAxis === option.id ? " selected" : "") + '>' + escapeHtml(option.label) + "</option>";
      }).join("") +
      '</select></label>' +
      '<label class="field"><span>因变量（Y 轴）</span><select id="trendMetricSelect">' +
      schema.metrics.map(function (metric) {
        return '<option value="' + escapeHtml(metric.id) + '"' + (state.trendMetric === metric.id ? " selected" : "") + '>' + escapeHtml(getMetricDisplayLabel(metric)) + "</option>";
      }).join("") +
      '</select></label>' +
      '<label class="field"><span>图表类型</span><select id="trendChartTypeSelect">' +
      '<option value="line"' + (state.trendChartType === "line" ? " selected" : "") + '>折线图</option>' +
      '<option value="bar"' + (state.trendChartType === "bar" ? " selected" : "") + '>柱状图</option>' +
      '<option value="pie"' + (state.trendChartType === "pie" ? " selected" : "") + '>饼图</option>' +
      '</select></label>' +
      "</div>" +
      '<div class="button-row"><div class="segment">' +
      schema.metrics.map(function (metric) {
        return '<button type="button" data-trend-metric="' + metric.id + '" class="' + (state.trendMetric === metric.id ? "active" : "") + '">' + escapeHtml(getMetricDisplayLabel(metric)) + "</button>";
      }).join("") +
      '</div><button type="button" class="button-ghost" id="showAllSeriesBtn">显示全部曲线</button></div>' +
      '<div class="legend-row" style="margin-top: 12px;">' +
      trendBundle.seriesMeta.map(function (series, index) {
        const hidden = state.hiddenSeries.includes(series.key);
        return (
          '<button type="button" class="legend-pill ' + (hidden ? "muted" : "") + '" data-toggle-series="' + escapeHtml(series.key) + '">' +
          '<span class="dot" style="background:' + SERIES_COLORS[index % SERIES_COLORS.length] + '"></span>' +
          escapeHtml(series.groupType === "control" ? series.label + " (" + series.sourceGroups.length + ")" : series.label) +
          "</button>"
        );
      }).join("") +
      "</div>" +
      '<div class="chart-shell">' + renderTrendSvg(schema, trendBundle, visibleSeriesKeys) + "</div>" +
      '<div class="insight-grid">' +
      trendInsights.map(function (item) {
        return '<article class="insight-card"><span>' + escapeHtml(item.label) + '</span><strong>' + escapeHtml(item.value) + '</strong><small>' + escapeHtml(item.note) + '</small></article>';
      }).join("") +
      "</div>" +
      "</section>"
    );
  }

  function renderDimensionPanel(schema, sections, scope) {
    if (!schema.dimensionFields.length) {
      return (
        '<section class="panel"><div class="panel-head"><div><p class="eyebrow">属性拆解</p><h2>维度对比</h2></div></div>' +
        '<div class="empty"><div><strong>当前数据未识别出明显属性字段</strong><p class="muted">像 grade / subject / city / channel 这种低基数字段，会被自动识别为维度。</p></div></div></section>'
      );
    }

    return (
      '<section class="panel">' +
      '<div class="panel-head"><div><p class="eyebrow">属性拆解</p><h2>按维度查看对比结果</h2>' +
      '<div class="subtitle">这里现在可以单独选组别，也可以叠加多个属性一起拆解。</div></div>' +
      '<div class="button-row"><button class="button-ghost" type="button" id="expandAllDimensionsBtn">全部展开</button>' +
      '<button class="button-ghost" type="button" id="collapseAllDimensionsBtn">全部收起</button></div></div>' +
      renderBreakdownFieldBuilder(schema) +
      renderDimensionGroupEditor(scope) +
      renderMetricVisibilityToolbar(schema, state.hiddenDimensionMetrics, "dimension", "属性拆解列显示控制") +
      '<div class="accordion-list">' +
      sections.map(function (section) {
        const key = section.key;
        const open = state.openDimensions.includes(key);
        const panelId = "dimension-panel-" + slugify(key);
        return (
          '<article class="accordion-item" id="' + panelId + '">' +
          '<button class="accordion-trigger" type="button" data-toggle-dimension="' + escapeHtml(key) + '">' +
          '<div><strong>' + escapeHtml(section.label) + '</strong><div class="muted">' + (open ? "点击收起当前属性组合" : "点击展开当前属性组合") + "</div></div>" +
          "<strong>" + (open ? "−" : "+") + "</strong></button>" +
          (open ? '<div class="accordion-body">' + renderComparisonTable(schema, section.rows, {
            hiddenMetricIds: state.hiddenDimensionMetrics,
            tableId: "dimension-table-" + slugify(key),
            exportFileName: "ab-dimension-" + slugify(key),
            exportTitle: section.label + " comparison table"
          }) + "</div>" : "") +
          "</article>"
        );
      }).join("") +
      "</div></section>"
    );
  }

  function renderSchemaPills(schema) {
    const parts = [
      "实验字段：" + formatFieldBadge(schema.experimentField, schema.roleChoices.experimentField),
      "日期字段：" + formatFieldBadge(schema.dateField, schema.roleChoices.dateField),
      "分组字段：" + formatFieldBadge(schema.groupField, schema.roleChoices.groupField),
      "分组类型字段：" + formatFieldBadge(schema.groupTypeField, schema.roleChoices.groupTypeField),
      "维度字段：" + (schema.dimensionFields.length ? schema.dimensionFields.map(function (field) { return field.label; }).join("、") : "无"),
      "指标字段：" + schema.metrics.map(function (metric) { return metric.label; }).join("、")
    ];

    return parts.map(function (item) {
      return '<span class="pill" style="cursor:default;">' + escapeHtml(item) + "</span>";
    }).join(" ");
  }

  function renderComparisonTable(schema, rows, options) {
    const sortedRows = sortComparisonRows(rows);
    const hiddenMetricIds = options && options.hiddenMetricIds ? options.hiddenMetricIds : [];
    const visibleMetrics = getVisibleMetrics(schema, hiddenMetricIds);
    const tableId = options && options.tableId ? options.tableId : ("comparison-table-" + Math.random().toString(36).slice(2, 8));
    const exportFileName = options && options.exportFileName ? options.exportFileName : "ab-table-export";
    const exportTitle = options && options.exportTitle ? options.exportTitle : "AB table export";

    if (!visibleMetrics.length) {
      return '<div class="empty inline-empty"><div><strong>当前已隐藏全部统计列</strong><p class="muted">点击上方列显示控制，重新打开你想看的指标列。</p></div></div>';
    }

    return (
      '<div class="table-toolbar"><div class="table-toolbar-actions">' +
      '<button type="button" class="button-ghost mini' + (state.showLiftBadges ? " active" : "") + '" data-toggle-lift-visibility="true">' + (state.showLiftBadges ? "全部隐藏涨幅比" : "全部显示涨幅比") + "</button>" +
      '<button type="button" class="button-ghost mini" data-export-table="' + escapeHtml(tableId) + '" data-export-file="' + escapeHtml(exportFileName) + '" data-export-title="' + escapeHtml(exportTitle) + '">导出 PDF</button>' +
      "</div></div>" +
      '<div class="table-wrap"><table id="' + escapeHtml(tableId) + '"><thead><tr><th class="sticky-col">组别</th>' +
      visibleMetrics.map(function (metric) {
        const active = state.tableSort.metricId === metric.id;
        const arrow = active ? (state.tableSort.direction === "desc" ? "↓" : "↑") : "↕";
        const liftVisible = isLiftColumnVisible(tableId, metric.id);
        return '<th><div class="metric-head"><button type="button" class="table-sort ' + (active ? "active" : "") + '" data-sort-metric="' + metric.id + '">' + escapeHtml(getMetricDisplayLabel(metric)) + "<span>" + arrow + '</span></button><button type="button" class="cell-lift-toggle ' + (liftVisible ? "active" : "off") + '" data-toggle-lift-column="' + escapeHtml(metric.id) + '" data-table-id="' + escapeHtml(tableId) + '" title="' + (liftVisible ? "隐藏这一列的涨幅比" : "显示这一列的涨幅比") + '">涨幅</button></div></th>';
      }).join("") +
      "</tr></thead><tbody>" +
      sortedRows.map(function (row) {
        const rowLiftVisible = isLiftRowVisible(tableId, row.key);
        return (
          '<tr class="' + (row.hasData ? "" : "row-muted") + '"><td class="group-cell sticky-col"><div class="group-cell-head"><strong>' + escapeHtml(row.label) + '</strong><button type="button" class="cell-lift-toggle ' + (rowLiftVisible ? "active" : "off") + '" data-toggle-lift-row="' + escapeHtml(row.key) + '" data-table-id="' + escapeHtml(tableId) + '" title="' + (rowLiftVisible ? "隐藏这一行的涨幅比" : "显示这一行的涨幅比") + '">涨幅</button></div><span class="muted">' +
          escapeHtml(row.hasData ? (row.groupType === "control" ? "来源：" + row.sourceGroups.join("、") : "实验组单独展示") : "当前切片下暂无样本") +
          "</span></td>" +
          visibleMetrics.map(function (metric) {
            const mainValue = getComparisonMetricDisplayValue(metric, row);
            const secondaryInfo = getComparisonMetricSecondaryInfo(metric, row);
            return (
              "<td><span class=\"metric-main\">" + escapeHtml(isCompareToControlMetric(metric) && row.groupType === "experiment" ? formatCompareMetric(mainValue) : formatMetric(metric, mainValue)) + '</span>' +
              (shouldShowLiftBadge(tableId, row.key, metric.id, secondaryInfo) ? '<span class="lift ' + secondaryInfo.className + '">' + escapeHtml(secondaryInfo.text) + "</span>" : "") +
              "</td>"
            );
          }).join("") +
          "</tr>"
        );
      }).join("") +
      "</tbody></table></div>"
    );
  }

  function renderTrendSvg(schema, trendBundle, visibleSeriesKeys) {
    const data = trendBundle.data;
    const metric = schema.metrics.find(function (item) {
      return item.id === state.trendMetric;
    });
    const width = 960;
    const height = 360;
    const padding = { top: 16, right: 18, bottom: 42, left: 68 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const domain = computeYAxisDomain(data, visibleSeriesKeys, state.trendMetric);
    const minY = domain[0];
    const maxY = domain[1];
    const ySpan = maxY - minY || 1;
    const xStep = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth / 2;
    const yTicks = [];

    for (let index = 0; index < 5; index += 1) {
      const ratio = index / 4;
      yTicks.push({
        value: maxY - ySpan * ratio,
        y: padding.top + innerHeight * ratio
      });
    }

    const gridLines = yTicks.map(function (tick) {
      return (
        '<line x1="' + padding.left + '" y1="' + tick.y.toFixed(2) + '" x2="' + (width - padding.right) + '" y2="' + tick.y.toFixed(2) + '" stroke="rgba(15,23,42,0.08)" stroke-dasharray="4 4"></line>' +
        '<text x="' + (padding.left - 12) + '" y="' + (tick.y + 4).toFixed(2) + '" text-anchor="end" font-size="12" fill="#5d6570">' +
        escapeHtml(metric && metric.type === "percent" ? integerFormatter.format(tick.value) + "%" : integerFormatter.format(tick.value)) +
        "</text>"
      );
    }).join("");

    const xLabels = data.map(function (point, index) {
      const x = padding.left + xStep * index;
      if (data.length > 6 && index !== 0 && index !== data.length - 1 && index % Math.ceil(data.length / 4) !== 0) return "";
      return '<text x="' + x.toFixed(2) + '" y="' + (height - 12) + '" text-anchor="middle" font-size="12" fill="#5d6570">' + escapeHtml(formatXAxisTick(trendBundle.xFieldId, point.xValue)) + "</text>";
    }).join("");

    let plottedPointCount = 0;
    const seriesPaths = trendBundle.seriesMeta.map(function (series, index) {
      if (!visibleSeriesKeys.includes(series.key)) return "";
      const points = data.map(function (point, pointIndex) {
        const value = point[getSeriesMetricKey(series.key, state.trendMetric)];
        if (typeof value !== "number" || !Number.isFinite(value)) return null;
        return {
          x: padding.left + xStep * pointIndex,
          y: padding.top + innerHeight - (value - minY) / ySpan * innerHeight,
          value: value,
          xValue: point.xValue
        };
      });
      const segments = splitPointSegments(points);
      const drawablePoints = points.filter(Boolean);
      if (!drawablePoints.length) return "";
      plottedPointCount += drawablePoints.length;

      const paths = segments.map(function (segment) {
        const path = segment.map(function (point, pointIndex) {
          return (pointIndex === 0 ? "M" : "L") + point.x.toFixed(2) + " " + point.y.toFixed(2);
        }).join(" ");
        return '<path d="' + path + '" fill="none" stroke="' + SERIES_COLORS[index % SERIES_COLORS.length] + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>';
      }).join("");

      const dots = drawablePoints.map(function (point) {
        return (
          '<circle cx="' + point.x.toFixed(2) + '" cy="' + point.y.toFixed(2) + '" r="3.5" fill="' + SERIES_COLORS[index % SERIES_COLORS.length] + '"><title>' +
          escapeHtml(series.label + " | " + formatXAxisTooltip(trendBundle.xFieldId, point.xValue) + " | " + formatTrendMetric(metric, point.value)) +
          "</title></circle>"
        );
      }).join("");

      const lastPoint = drawablePoints[drawablePoints.length - 1];
      const endLabel = lastPoint
        ? '<text x="' + Math.min(width - padding.right, lastPoint.x + 10).toFixed(2) + '" y="' + Math.max(padding.top + 12, lastPoint.y - 10).toFixed(2) + '" font-size="12" fill="' + SERIES_COLORS[index % SERIES_COLORS.length] + '">' + escapeHtml(series.label) + "</text>"
        : "";

      return paths + dots + endLabel;
    }).join("");

    const empty = !visibleSeriesKeys.length
      ? '<text x="' + width / 2 + '" y="' + height / 2 + '" text-anchor="middle" font-size="16" fill="#5d6570">当前没有可见折线，请点击图例恢复显示</text>'
      : (!plottedPointCount
        ? '<text x="' + width / 2 + '" y="' + height / 2 + '" text-anchor="middle" font-size="16" fill="#5d6570">当前筛选条件下没有有效趋势点位</text>'
        : "");

    return (
      '<svg class="chart-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="趋势图">' +
      gridLines +
      '<line x1="' + padding.left + '" y1="' + (height - padding.bottom) + '" x2="' + (width - padding.right) + '" y2="' + (height - padding.bottom) + '" stroke="rgba(23,33,43,0.16)"></line>' +
      '<line x1="' + padding.left + '" y1="' + padding.top + '" x2="' + padding.left + '" y2="' + (height - padding.bottom) + '" stroke="rgba(23,33,43,0.16)"></line>' +
      xLabels +
      seriesPaths +
      empty +
      "</svg>" +
      '<div class="chart-meta"><span>X 轴：' + escapeHtml(getTrendXAxisLabel(schema, trendBundle.xFieldId)) + ' · Y 轴：' + escapeHtml(metric ? getMetricDisplayLabel(metric) : "") + "</span><span>Y 轴会按当前可见曲线自动适配，缺失点位不会再被误画成 0。</span></div>"
    );
  }

  function renderPill(label, selected, variant, groupType) {
    return '<button class="pill ' + (selected ? "selected " + variant : "") + '" type="button" data-toggle-group="' + groupType + '" data-group="' + escapeHtml(label) + '">' + escapeHtml(label) + "</button>";
  }

  function renderDimensionValuePill(fieldId, value, selected) {
    return '<button class="pill ' + (selected ? "selected experiment" : "") + '" type="button" data-toggle-dimension-value="' + escapeHtml(fieldId) + '" data-value="' + escapeHtml(value) + '">' + escapeHtml(value) + "</button>";
  }

  function renderGroupChooserPill(group) {
    const isControl = state.selectedControls.includes(group);
    const isExperiment = state.selectedExperiments.includes(group);
    const tone = isControl ? "selected control" : (isExperiment ? "selected experiment" : "");
    const suffix = isControl ? " · 对照" : (isExperiment ? " · 实验" : "");
    return '<button class="pill ' + tone + '" type="button" data-choose-group="' + escapeHtml(group) + '">' + escapeHtml(group + suffix) + "</button>";
  }

  function renderDimensionGroupChooserPill(group) {
    const isControl = state.dimensionSelectedControls.includes(group);
    const isExperiment = state.dimensionSelectedExperiments.includes(group);
    const tone = isControl ? "selected control" : (isExperiment ? "selected experiment" : "");
    const suffix = isControl ? " · 对照" : (isExperiment ? " · 实验" : "");
    return '<button class="pill ' + tone + '" type="button" data-choose-dimension-group="' + escapeHtml(group) + '">' + escapeHtml(group + suffix) + "</button>";
  }

  function renderSegmentButton(value, label, activeValue) {
    return '<button type="button" data-caliber="' + value + '" class="' + (value === activeValue ? "active" : "") + '">' + escapeHtml(label) + "</button>";
  }

  function renderBreakdownFieldBuilder(schema) {
    return (
      '<div class="breakdown-builder">' +
      '<div class="filter-head"><strong>属性组合</strong><span class="muted">最多可叠加 3 个属性</span></div>' +
      state.breakdownFields.map(function (fieldId, index) {
        return (
          '<div class="breakdown-row">' +
          '<label class="field"><span>属性 ' + (index + 1) + '</span><select data-breakdown-field-select="' + index + '">' +
          schema.dimensionFields.map(function (field) {
            return '<option value="' + escapeHtml(field.id) + '"' + (field.id === fieldId ? " selected" : "") + '>' + escapeHtml(field.label) + "</option>";
          }).join("") +
          '</select></label>' +
          '<button type="button" class="button-ghost mini" data-remove-breakdown-field="' + index + '"' + (state.breakdownFields.length === 1 ? " disabled" : "") + '>移除</button>' +
          "</div>"
        );
      }).join("") +
      '<div class="button-row"><button type="button" class="button-ghost mini" id="addBreakdownFieldBtn"' + (state.breakdownFields.length >= Math.min(3, schema.dimensionFields.length) ? " disabled" : "") + '>新增属性</button></div>' +
      "</div>"
    );
  }

  function renderDimensionGroupEditor(scope) {
    return (
      '<div class="dimension-group-editor">' +
      '<div class="filter-head"><strong>属性拆解组别</strong><span class="muted">这里可以和上面的全局组别不同</span></div>' +
      '<div class="pill-row">' +
      scope.allGroups.map(function (group) {
        return renderDimensionGroupChooserPill(group);
      }).join("") +
      "</div></div>"
    );
  }

  function renderRecognitionCard(label, value, choice, samples) {
    const tone = choice && choice.source === "manual" ? "manual" : (choice && choice.score >= 120 ? "high" : (choice && choice.score >= 60 ? "mid" : "low"));
    return (
      '<article class="recognition-card ' + tone + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value || "未识别") + '</strong><small>' +
      escapeHtml((choice && choice.source === "manual") ? "手动纠偏" : (choice && choice.score >= 120 ? "高置信识别" : (choice && choice.score >= 60 ? "中置信识别" : "低置信识别"))) +
      '</small><div class="tag-row">' +
      (samples && samples.length ? samples.map(function (sample) {
        return '<span class="mini-tag">' + escapeHtml(sample) + '</span>';
      }).join("") : '<span class="mini-tag">暂无样例</span>') +
      "</div></article>"
    );
  }

  function renderFieldSelect(schema, roleKey, label, allowAuto) {
    return (
      '<label class="field"><span>' + escapeHtml(label) + '</span><select data-field-override="' + roleKey + '">' +
      (allowAuto ? '<option value="">自动识别</option>' : "") +
      schema.columns.map(function (column) {
        const selected = state.fieldOverrides[roleKey] === column.key;
        return '<option value="' + escapeHtml(column.key) + '"' + (selected ? " selected" : "") + ">" + escapeHtml(column.label) + "</option>";
      }).join("") +
      '</select><small class="field-note">当前：' + escapeHtml(formatFieldBadge(schema[roleKey], schema.roleChoices[roleKey])) + "</small></label>"
    );
  }

  function renderColumnProfileTable(schema) {
    return (
      '<div class="table-toolbar"><button type="button" class="button-ghost mini" data-export-table="recognition-profile-table" data-export-file="ab-column-profile" data-export-title="字段画像表">导出 PDF</button></div>' +
      '<div class="table-wrap recognition-table-wrap"><table id="recognition-profile-table" class="recognition-table"><thead><tr><th>字段名</th><th>角色</th><th>值类型</th><th>样例值</th></tr></thead><tbody>' +
      schema.columns.map(function (column) {
        const role = getColumnRole(schema, column.key);
        const typeLabel = column.dateRatio >= 0.7
          ? "日期"
          : column.isMetricCandidate
            ? (PERCENT_HEADER_HINTS.test(column.normalized) ? "百分比指标" : "数值指标")
            : (column.isCategoricalCandidate ? "维度候选" : "通用字段");
        return '<tr><td><strong>' + escapeHtml(column.label) + '</strong></td><td><span class="mini-tag">' + escapeHtml(role) + '</span></td><td>' + escapeHtml(typeLabel) + '</td><td>' + escapeHtml(column.sampleValues.slice(0, 4).join(" / ") || "--") + "</td></tr>";
      }).join("") +
      "</tbody></table></div>"
    );
  }

  function getDimensionLabel(schema, fieldId) {
    const target = schema.dimensionFields.find(function (field) {
      return field.id === fieldId;
    });
    return target ? target.label : "未选择维度";
  }

  function getTrendXAxisOptions(schema) {
    const options = [];
    if (schema.dateField) {
      options.push({ id: "date", label: "日期" });
    }
    schema.dimensionFields.forEach(function (field) {
      options.push({ id: field.id, label: field.label });
    });
    return options;
  }

  function getTrendXAxisLabel(schema, xFieldId) {
    if (xFieldId === "date") return "日期";
    if (xFieldId === "group") return "组别";
    return getDimensionLabel(schema, xFieldId);
  }

  function formatXAxisTick(xFieldId, value) {
    if (xFieldId === "date") return cnDate(value).slice(5);
    const text = String(value || "");
    return text.length > 8 ? text.slice(0, 8) + "…" : text;
  }

  function formatXAxisTooltip(xFieldId, value) {
    if (xFieldId === "date") return cnDate(value);
    return String(value || "");
  }

  function getColumnRole(schema, columnKey) {
    if (schema.experimentField === columnKey) return "实验字段";
    if (schema.dateField === columnKey) return "日期字段";
    if (schema.groupField === columnKey) return "分组字段";
    if (schema.groupTypeField === columnKey) return "分组类型";
    if (schema.baseMetrics.some(function (metric) { return metric.key === columnKey; })) return "指标";
    if (schema.dimensionFields.some(function (field) { return field.key === columnKey; })) return "维度";
    return "未使用";
  }

  function getColumnSamples(schema, columnKey) {
    if (!columnKey) return [];
    const column = schema.columns.find(function (item) {
      return item.key === columnKey;
    });
    return column ? column.sampleValues.slice(0, 4) : [];
  }

  function formatFieldBadge(fieldKey, choice) {
    if (!fieldKey) return "未识别";
    return fieldKey + ((choice && choice.source === "manual") ? "（手动）" : "");
  }

  function sortComparisonRows(rows) {
    const metricId = state.tableSort.metricId;
    const direction = state.tableSort.direction === "asc" ? 1 : -1;
    const controlRows = rows.filter(function (row) { return row.groupType === "control"; });
    const experimentRows = rows.filter(function (row) { return row.groupType !== "control"; }).slice();
    const metric = state.schema && state.schema.metrics
      ? state.schema.metrics.find(function (item) { return item.id === metricId; })
      : null;

    experimentRows.sort(function (left, right) {
      const leftValue = metric ? getComparisonMetricDisplayValue(metric, left) : left.values[metricId];
      const rightValue = metric ? getComparisonMetricDisplayValue(metric, right) : right.values[metricId];
      if (leftValue === null && rightValue === null) return collator.compare(left.label, right.label);
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      if (leftValue === rightValue) return collator.compare(left.label, right.label);
      return (leftValue - rightValue) * direction;
    });

    return controlRows.concat(experimentRows);
  }

  function splitPointSegments(points) {
    const segments = [];
    let current = [];

    points.forEach(function (point) {
      if (point) {
        current.push(point);
        return;
      }
      if (current.length) {
        segments.push(current);
        current = [];
      }
    });

    if (current.length) segments.push(current);
    return segments;
  }

  function buildTrendInsights(schema, trendBundle, comparisonRows, visibleSeriesKeys) {
    const metric = schema.metrics.find(function (item) {
      return item.id === state.trendMetric;
    });
    if (!metric) return [];

    const visibleSeries = trendBundle.seriesMeta.filter(function (series) {
      return visibleSeriesKeys.includes(series.key);
    });
    const peak = findPeakPoint(metric, trendBundle, visibleSeries);
    const bestRow = comparisonRows
      .filter(function (row) {
        return row.groupType === "experiment" && row.lifts[metric.id] !== null;
      })
      .sort(function (left, right) {
        return right.lifts[metric.id] - left.lifts[metric.id];
      })[0];
    const momentum = findMomentumSeries(metric, trendBundle, visibleSeries);

    return [
      {
        label: "当前最优实验",
        value: bestRow ? bestRow.label + " " + formatLift(bestRow.lifts[metric.id]) : "暂无可比 lift",
        note: bestRow ? "按当前筛选口径对照组比较" : "当前指标没有可计算的对照 lift"
      },
      {
        label: "全周期峰值",
        value: peak ? peak.seriesLabel + " · " + formatTrendMetric(metric, peak.value) : "暂无峰值",
        note: peak ? formatXAxisTooltip(trendBundle.xFieldId, peak.xValue) : "当前横轴范围内没有有效点位"
      },
      {
        label: "趋势动量",
        value: momentum ? momentum.seriesLabel + " " + momentum.direction : "暂无趋势结论",
        note: momentum ? "首日到末日变化 " + formatTrendMetric(metric, Math.abs(momentum.delta)) : "至少需要两个有效点位"
      }
    ];
  }

  function findPeakPoint(metric, trendBundle, visibleSeries) {
    let peak = null;
    trendBundle.data.forEach(function (point) {
      visibleSeries.forEach(function (series) {
        const value = point[getSeriesMetricKey(series.key, metric.id)];
        if (!Number.isFinite(value)) return;
        if (!peak || value > peak.value) {
          peak = {
            seriesLabel: series.label,
            value: value,
            xValue: point.xValue
          };
        }
      });
    });
    return peak;
  }

  function findMomentumSeries(metric, trendBundle, visibleSeries) {
    let best = null;

    visibleSeries.forEach(function (series) {
      const points = trendBundle.data.map(function (point) {
        const value = point[getSeriesMetricKey(series.key, metric.id)];
        return Number.isFinite(value) ? { value: value, xValue: point.xValue } : null;
      }).filter(Boolean);
      if (points.length < 2) return;
      const delta = points[points.length - 1].value - points[0].value;
      if (!best || Math.abs(delta) > Math.abs(best.delta)) {
        best = {
          seriesLabel: series.label,
          delta: delta,
          direction: delta > 0 ? "上行" : (delta < 0 ? "下行" : "持平")
        };
      }
    });

    return best;
  }

  function getMetricLabel(schema, metricId) {
    const metric = schema.baseMetrics.find(function (item) {
      return item.id === metricId;
    }) || schema.metrics.find(function (item) {
      return item.id === metricId;
    });
    return metric ? metric.label : metricId;
  }

  function parseGroupInput(rawValue, allGroups) {
    const tokens = unique(String(rawValue || "")
      .split(/[\s,，;；\n\r\t]+/)
      .map(function (item) { return item.trim(); })
      .filter(Boolean));

    return {
      values: tokens.filter(function (item) { return allGroups.includes(item); }),
      unknown: tokens.filter(function (item) { return !allGroups.includes(item); })
    };
  }

  function normalizeGroupSelections(scope) {
    state.selectedControls = unique(state.selectedControls)
      .filter(function (group) { return scope.allGroups.includes(group); })
      .slice(0, 3);
    state.selectedExperiments = unique(state.selectedExperiments)
      .filter(function (group) { return scope.allGroups.includes(group) && !state.selectedControls.includes(group); })
      .slice(0, 7);

    if (!state.selectedControls.length && scope.allGroups.length) {
      state.selectedControls = scope.controlGroups.length ? scope.controlGroups.slice(0, 1) : scope.allGroups.slice(0, 1);
    }
    if (!state.selectedExperiments.length) {
      state.selectedExperiments = scope.allGroups.filter(function (group) {
        return !state.selectedControls.includes(group);
      }).slice(0, 1);
    }
  }

  function normalizeDimensionGroupSelections(scope) {
    state.dimensionSelectedControls = unique(state.dimensionSelectedControls)
      .filter(function (group) { return scope.allGroups.includes(group); })
      .slice(0, 3);
    state.dimensionSelectedExperiments = unique(state.dimensionSelectedExperiments)
      .filter(function (group) { return scope.allGroups.includes(group) && !state.dimensionSelectedControls.includes(group); })
      .slice(0, 7);

    if (!state.dimensionSelectedControls.length) {
      state.dimensionSelectedControls = state.selectedControls.slice(0, 3);
    }
    if (!state.dimensionSelectedExperiments.length) {
      state.dimensionSelectedExperiments = state.selectedExperiments.filter(function (group) {
        return !state.dimensionSelectedControls.includes(group);
      }).slice(0, 7);
    }
  }

  function cycleDimensionGroupSelection(scope, group) {
    if (state.dimensionSelectedControls.includes(group)) {
      state.dimensionSelectedControls = state.dimensionSelectedControls.filter(function (item) {
        return item !== group;
      });
      if (!state.dimensionSelectedExperiments.includes(group) && state.dimensionSelectedExperiments.length < 7) {
        state.dimensionSelectedExperiments = state.dimensionSelectedExperiments.concat(group);
      }
    } else if (state.dimensionSelectedExperiments.includes(group)) {
      state.dimensionSelectedExperiments = state.dimensionSelectedExperiments.filter(function (item) {
        return item !== group;
      });
    } else if (state.dimensionSelectedControls.length < 3) {
      state.dimensionSelectedControls = state.dimensionSelectedControls.concat(group);
    } else if (state.dimensionSelectedExperiments.length < 7) {
      state.dimensionSelectedExperiments = state.dimensionSelectedExperiments.concat(group);
    }
    normalizeDimensionGroupSelections(scope);
    render();
  }

  dom.fileInput.addEventListener("change", function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    void loadFile(file, "手动上传");
    event.target.value = "";
  });

  dom.loadSampleBtn.addEventListener("click", function () {
    void loadSampleData();
  });

  dom.exportPageBtn.addEventListener("click", function () {
    void exportSection(dom.appRoot, "ab-dashboard-full");
  });

  dom.exportSummaryBtn.addEventListener("click", function () {
    void exportSection(document.getElementById("summaryPanel"), "ab-summary-table");
  });

  dom.exportTrendBtn.addEventListener("click", function () {
    void exportSection(document.getElementById("trendPanel"), "ab-trend-chart");
  });

  function syncTrendZoomControls(input) {
    const slider = input || document.getElementById("trendZoomScaleInput");
    const valueNode = document.getElementById("trendZoomValue");
    const hintNode = document.getElementById("trendZoomHint");
    if (slider) {
      slider.style.setProperty("--slider-progress", String(slider.value) + "%");
    }
    if (valueNode) {
      valueNode.textContent = "×" + formatTrendZoomScale(state.trendZoomScale);
    }
    if (hintNode) {
      hintNode.textContent = state.trendChartType === "pie"
        ? "饼图模式下不应用 Y 轴倍数"
        : (state.trendChartType === "line"
          ? "中点为 ×1；折线图会保持上下刻度不变，只拉伸图高与刻度"
          : "中点为 ×1，向右放大，向左缩小");
    }
  }

  function updateTrendChartShell() {
    const schema = state.schema;
    if (!schema) return;
    const trendPanel = document.getElementById("trendPanel");
    const chartShell = trendPanel ? trendPanel.querySelector(".chart-shell") : null;
    if (!chartShell) return;

    const experimentIds = getExperimentIds(state.records);
    const resolvedExperimentId = resolveExperimentId(experimentIds, state.experimentQuery);
    const scope = getExperimentScope(state.records, resolvedExperimentId);
    if (!scope) return;

    const dateFilteredRows = schema.dateField
      ? filterRowsByDateRange(scope.rows, state.dateRange.start, state.dateRange.end)
      : scope.rows;
    const filteredRows = filterRowsByDimensionFilters(dateFilteredRows, state.dimensionFilters);
    const trendBundle = buildTrendData({
      rows: filteredRows,
      selectedControls: state.selectedControls,
      selectedExperiments: state.selectedExperiments,
      schema: schema,
      xFieldId: state.trendXAxis
    });
    const visibleSeriesKeys = trendBundle.seriesMeta
      .map(function (item) { return item.key; })
      .filter(function (key) { return !state.hiddenSeries.includes(key); });
    chartShell.innerHTML = renderTrendSvg(schema, trendBundle, visibleSeriesKeys);
    syncTrendZoomControls();
  }

  function scheduleTrendChartRefresh() {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      updateTrendChartShell();
      return;
    }
    if (trendChartRefreshFrame) {
      window.cancelAnimationFrame(trendChartRefreshFrame);
    }
    trendChartRefreshFrame = window.requestAnimationFrame(function () {
      trendChartRefreshFrame = 0;
      updateTrendChartShell();
    });
  }

  function wireDashboardEvents(scope) {
    const experimentInput = document.getElementById("experimentQueryInput");
    const startDateInput = document.getElementById("startDateInput");
    const endDateInput = document.getElementById("endDateInput");
    const resetRecognitionBtn = document.getElementById("resetRecognitionBtn");
    const showAllSeriesBtn = document.getElementById("showAllSeriesBtn");
    const applyGroupSelectionBtn = document.getElementById("applyGroupSelectionBtn");
    const applyFormulaBtn = document.getElementById("applyFormulaBtn");
    const addCustomMetricBtn = document.getElementById("addCustomMetricBtn");
    const trendXAxisSelect = document.getElementById("trendXAxisSelect");
    const trendMetricSelect = document.getElementById("trendMetricSelect");
    const trendChartTypeSelect = document.getElementById("trendChartTypeSelect");
    const trendZoomScaleInput = document.getElementById("trendZoomScaleInput");
    const addBreakdownFieldBtn = document.getElementById("addBreakdownFieldBtn");

    if (experimentInput) {
      experimentInput.addEventListener("input", function (event) {
        state.experimentQuery = event.target.value;
        render();
      });
    }

    if (startDateInput) {
      startDateInput.addEventListener("input", function (event) {
        state.dateRange.start = event.target.value;
        render();
      });
    }

    if (endDateInput) {
      endDateInput.addEventListener("input", function (event) {
        state.dateRange.end = event.target.value;
        render();
      });
    }

    if (trendXAxisSelect) {
      trendXAxisSelect.addEventListener("change", function (event) {
        state.trendXAxis = event.target.value;
        state.hiddenSeries = [];
        render();
      });
    }

    if (trendMetricSelect) {
      trendMetricSelect.addEventListener("change", function (event) {
        state.trendMetric = event.target.value;
        render();
      });
    }

    if (trendChartTypeSelect) {
      trendChartTypeSelect.addEventListener("change", function (event) {
        state.trendChartType = event.target.value;
        render();
      });
    }

    if (trendZoomScaleInput) {
      syncTrendZoomControls(trendZoomScaleInput);
      trendZoomScaleInput.addEventListener("input", function (event) {
        state.trendZoomScale = sliderValueToTrendZoomScale(event.target.value);
        syncTrendZoomControls(event.target);
        scheduleTrendChartRefresh();
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-field-override]"), function (select) {
      select.addEventListener("change", function () {
        const roleKey = select.getAttribute("data-field-override");
        state.fieldOverrides[roleKey] = select.value;
        try {
          rebuildFromRawRows();
          state.error = "";
        } catch (error) {
          state.error = error && error.message ? error.message : "字段纠偏失败，请重新选择。";
        }
        render();
      });
    });

    if (resetRecognitionBtn) {
      resetRecognitionBtn.addEventListener("click", function () {
        state.fieldOverrides = {
          experimentField: "",
          dateField: "",
          groupField: "",
          groupTypeField: ""
        };
        try {
          rebuildFromRawRows();
          state.error = "";
        } catch (error) {
          state.error = error && error.message ? error.message : "恢复自动识别失败。";
        }
        render();
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-caliber]"), function (button) {
      button.addEventListener("click", function () {
        state.caliber = button.getAttribute("data-caliber");
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-trend-metric]"), function (button) {
      button.addEventListener("click", function () {
        state.trendMetric = button.getAttribute("data-trend-metric");
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-sort-metric]"), function (button) {
      button.addEventListener("click", function () {
        const metricId = button.getAttribute("data-sort-metric");
        if (state.tableSort.metricId === metricId) {
          state.tableSort.direction = state.tableSort.direction === "desc" ? "asc" : "desc";
        } else {
          state.tableSort.metricId = metricId;
          state.tableSort.direction = "desc";
        }
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-lift-visibility]"), function (button) {
      button.addEventListener("click", function () {
        state.showLiftBadges = !state.showLiftBadges;
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-lift-row]"), function (button) {
      button.addEventListener("click", function () {
        toggleLiftRowVisibility(button.getAttribute("data-table-id"), button.getAttribute("data-toggle-lift-row"));
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-lift-column]"), function (button) {
      button.addEventListener("click", function () {
        toggleLiftColumnVisibility(button.getAttribute("data-table-id"), button.getAttribute("data-toggle-lift-column"));
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-metric-visibility]"), function (button) {
      button.addEventListener("click", function () {
        const scopeKey = button.getAttribute("data-toggle-metric-visibility");
        const metricId = button.getAttribute("data-metric-id");
        toggleMetricVisibility(scopeKey, metricId, state.schema);
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-export-table]"), function (button) {
      button.addEventListener("click", function () {
        const tableId = button.getAttribute("data-export-table");
        const fileName = button.getAttribute("data-export-file") || "ab-table-export";
        const title = button.getAttribute("data-export-title") || "AB table export";
        void exportTableAsPdf(document.getElementById(tableId), fileName, title);
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-dimension-field]"), function (button) {
      button.addEventListener("click", function () {
        const fieldId = button.getAttribute("data-toggle-dimension-field");
        if (state.dimensionFilterFields.includes(fieldId)) {
          state.dimensionFilterFields = state.dimensionFilterFields.filter(function (item) { return item !== fieldId; });
          state.dimensionFilters[fieldId] = [];
        } else {
          state.dimensionFilterFields = state.dimensionFilterFields.concat(fieldId);
        }
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-dimension-value]"), function (button) {
      button.addEventListener("click", function () {
        const fieldId = button.getAttribute("data-toggle-dimension-value");
        const value = button.getAttribute("data-value");
        const current = state.dimensionFilters[fieldId] || [];
        if (current.includes(value)) {
          state.dimensionFilters[fieldId] = current.filter(function (item) { return item !== value; });
        } else {
          state.dimensionFilters[fieldId] = current.concat(value);
        }
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-dimension-select-all]"), function (button) {
      button.addEventListener("click", function () {
        const fieldId = button.getAttribute("data-dimension-select-all");
        state.dimensionFilters[fieldId] = [];
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-dimension-clear]"), function (button) {
      button.addEventListener("click", function () {
        const fieldId = button.getAttribute("data-dimension-clear");
        state.dimensionFilters[fieldId] = [];
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-series]"), function (button) {
      button.addEventListener("click", function () {
        const key = button.getAttribute("data-toggle-series");
        if (state.hiddenSeries.includes(key)) {
          state.hiddenSeries = state.hiddenSeries.filter(function (item) {
            return item !== key;
          });
        } else {
          state.hiddenSeries = state.hiddenSeries.concat(key);
        }
        render();
      });
    });

    if (showAllSeriesBtn) {
      showAllSeriesBtn.addEventListener("click", function () {
        state.hiddenSeries = [];
        render();
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-group]"), function (button) {
      button.addEventListener("click", function () {
        toggleGroup(button.getAttribute("data-toggle-group"), button.getAttribute("data-group"));
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-choose-group]"), function (button) {
      button.addEventListener("click", function () {
        const group = button.getAttribute("data-choose-group");
        if (state.selectedControls.includes(group)) {
          state.selectedControls = state.selectedControls.filter(function (item) { return item !== group; });
          if (!state.selectedExperiments.includes(group) && state.selectedExperiments.length < 7) {
            state.selectedExperiments = state.selectedExperiments.concat(group);
          }
        } else if (state.selectedExperiments.includes(group)) {
          state.selectedExperiments = state.selectedExperiments.filter(function (item) { return item !== group; });
        } else if (state.selectedControls.length < 3) {
          state.selectedControls = state.selectedControls.concat(group);
        } else if (state.selectedExperiments.length < 7) {
          state.selectedExperiments = state.selectedExperiments.concat(group);
        }
        normalizeGroupSelections(scope);
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-choose-dimension-group]"), function (button) {
      button.addEventListener("click", function () {
        cycleDimensionGroupSelection(scope, button.getAttribute("data-choose-dimension-group"));
      });
    });

    if (applyGroupSelectionBtn) {
      applyGroupSelectionBtn.addEventListener("click", function () {
        const controlInput = document.getElementById("controlGroupsInput");
        const experimentInputArea = document.getElementById("experimentGroupsInput");
        const parsedControls = parseGroupInput(controlInput ? controlInput.value : "", scope.allGroups);
        const parsedExperiments = parseGroupInput(experimentInputArea ? experimentInputArea.value : "", scope.allGroups);
        const overlap = parsedControls.values.filter(function (group) { return parsedExperiments.values.includes(group); });

        if (parsedControls.unknown.length || parsedExperiments.unknown.length) {
          state.error = "存在未识别的组 ID：" + parsedControls.unknown.concat(parsedExperiments.unknown).join("、");
          render();
          return;
        }
        if (overlap.length) {
          state.error = "同一个组不能同时属于对照组和实验组：" + overlap.join("、");
          render();
          return;
        }

        state.selectedControls = parsedControls.values.slice(0, 3);
        state.selectedExperiments = parsedExperiments.values.slice(0, 7);
        normalizeGroupSelections(scope);
        state.error = "";
        render();
      });
    }

    if (applyFormulaBtn && document.querySelectorAll("[data-formula-id]").length) {
      applyFormulaBtn.addEventListener("click", function () {
        const nextOverrides = {};
        Array.prototype.forEach.call(document.querySelectorAll("[data-formula-id]"), function (input) {
          const formulaId = input.getAttribute("data-formula-id");
          const part = input.getAttribute("data-formula-part");
          nextOverrides[formulaId] = nextOverrides[formulaId] || {};
          nextOverrides[formulaId][part + "Id"] = part === "multiplier" ? undefined : input.value;
          if (part === "multiplier") {
            nextOverrides[formulaId].multiplier = Number(input.value);
          }
        });
        state.formulaOverrides = Object.keys(nextOverrides).reduce(function (accumulator, formulaId) {
          const item = nextOverrides[formulaId];
          accumulator[formulaId] = {
            numeratorId: item.numeratorId,
            denominatorId: item.denominatorId,
            multiplier: Number.isFinite(item.multiplier) ? item.multiplier : 100
          };
          return accumulator;
        }, {});
        try {
          rebuildFromRawRows();
          state.error = "";
        } catch (error) {
          state.error = error && error.message ? error.message : "公式应用失败。";
        }
        render();
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-breakdown-field]"), function (button) {
      button.addEventListener("click", function () {
        state.breakdownField = button.getAttribute("data-breakdown-field");
        state.openDimensions = [];
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-breakdown-field-select]"), function (select) {
      select.addEventListener("change", function () {
        const index = Number(select.getAttribute("data-breakdown-field-select"));
        if (!Number.isFinite(index)) return;
        state.breakdownFields[index] = select.value;
        state.breakdownFields = state.breakdownFields.filter(function (fieldId, fieldIndex, array) {
          return array.indexOf(fieldId) === fieldIndex;
        });
        state.breakdownField = state.breakdownFields[0] || "";
        state.openDimensions = [];
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-remove-breakdown-field]"), function (button) {
      button.addEventListener("click", function () {
        const index = Number(button.getAttribute("data-remove-breakdown-field"));
        if (!Number.isFinite(index) || state.breakdownFields.length <= 1) return;
        state.breakdownFields.splice(index, 1);
        state.breakdownField = state.breakdownFields[0] || "";
        state.openDimensions = [];
        render();
      });
    });

    if (addBreakdownFieldBtn) {
      addBreakdownFieldBtn.addEventListener("click", function () {
        const nextField = state.schema.dimensionFields.find(function (field) {
          return !state.breakdownFields.includes(field.id);
        });
        if (!nextField || state.breakdownFields.length >= Math.min(3, state.schema.dimensionFields.length)) return;
        state.breakdownFields = state.breakdownFields.concat(nextField.id);
        state.breakdownField = state.breakdownFields[0] || "";
        state.openDimensions = [];
        render();
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-dimension]"), function (button) {
      button.addEventListener("click", function () {
        const key = button.getAttribute("data-toggle-dimension");
        if (state.openDimensions.includes(key)) {
          state.openDimensions = state.openDimensions.filter(function (item) {
            return item !== key;
          });
        } else {
          state.openDimensions = state.openDimensions.concat(key);
        }
        render();
      });
    });

    const expandAllBtn = document.getElementById("expandAllDimensionsBtn");
    const collapseAllBtn = document.getElementById("collapseAllDimensionsBtn");

    if (expandAllBtn) {
      expandAllBtn.addEventListener("click", function () {
        const schema = state.schema;
        const filteredRows = schema && schema.dateField
          ? filterRowsByDateRange(scope.rows, state.dateRange.start, state.dateRange.end)
          : scope.rows;
        const dimensionRows = filterRowsByDimensionFilters(filteredRows, state.dimensionFilters);
        const keys = buildDimensionSections({
          rows: dimensionRows,
          selectedControls: state.dimensionSelectedControls,
          selectedExperiments: state.dimensionSelectedExperiments,
          caliber: state.caliber,
          days: schema.dateField ? countDaysInclusive(state.dateRange.start, state.dateRange.end) : 1,
          schema: schema,
          dimensionFieldIds: state.breakdownFields
        }).map(function (section) {
          return section.key;
        });
        state.openDimensions = keys;
        render();
      });
    }

    if (collapseAllBtn) {
      collapseAllBtn.addEventListener("click", function () {
        state.openDimensions = [];
        render();
      });
    }

    bindExtraDashboardEvents(scope);
  }

  function toggleGroup(groupType, groupName) {
    state.error = "";

    if (groupType === "control") {
      if (state.selectedControls.includes(groupName)) {
        if (state.selectedControls.length === 1) {
          state.error = "至少保留 1 个对照组。";
          render();
          return;
        }
        state.selectedControls = state.selectedControls.filter(function (item) {
          return item !== groupName;
        });
      } else {
        if (state.selectedControls.length >= 3) {
          state.error = "最多选择 3 个对照组。";
          render();
          return;
        }
        state.selectedControls = state.selectedControls.concat(groupName);
      }
    }

    if (groupType === "experiment") {
      if (state.selectedExperiments.includes(groupName)) {
        if (state.selectedExperiments.length === 1) {
          state.error = "至少保留 1 个实验组。";
          render();
          return;
        }
        state.selectedExperiments = state.selectedExperiments.filter(function (item) {
          return item !== groupName;
        });
      } else {
        if (state.selectedExperiments.length >= 7) {
          state.error = "最多选择 7 个实验组。";
          render();
          return;
        }
        state.selectedExperiments = state.selectedExperiments.concat(groupName);
      }
    }

    const validSeries = ["control_merged"].concat(state.selectedExperiments.map(function (group) {
      return "experiment:" + group;
    }));
    state.hiddenSeries = state.hiddenSeries.filter(function (key) {
      return validSeries.includes(key);
    });
    render();
  }

  async function exportSection(node, fileName) {
    if (!node) return;
    if (typeof html2canvas !== "function") {
      alert("当前页面没有成功加载截图依赖，请优先通过本地文件或本地服务打开。");
      return;
    }

    const canvas = await html2canvas(node, {
      backgroundColor: "#f3efe3",
      scale: 2,
      useCORS: true,
      logging: false
    });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = fileName + ".png";
    link.click();
  }

  async function exportTableAsPdf(tableNode, fileName, title) {
    if (!tableNode) return;
    if (typeof html2canvas !== "function") {
      alert("当前页面没有成功加载导出依赖，请优先通过本地文件或本地服务打开。");
      return;
    }

    const canvas = await html2canvas(tableNode, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      width: tableNode.scrollWidth,
      height: tableNode.scrollHeight,
      windowWidth: tableNode.scrollWidth,
      windowHeight: tableNode.scrollHeight,
      scrollX: 0,
      scrollY: 0
    });

    const imageData = canvas.toDataURL("image/png");
    const win = window.open("", "_blank", "noopener,noreferrer,width=1280,height=900");
    if (!win) {
      alert("导出窗口被浏览器拦截，请允许弹窗后重试。");
      return;
    }

    win.document.write(
      '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(fileName) + '</title>' +
      '<style>@page{size:A3 landscape;margin:12mm}body{margin:0;font-family:Segoe UI,system-ui,sans-serif;color:#111}.shell{display:flex;flex-direction:column;gap:10px}h1{margin:0;font-size:20px}img{width:100%;height:auto;border:1px solid #e5e7eb;border-radius:6px}</style>' +
      '</head><body><div class="shell">' +
      (title ? '<h1>' + escapeHtml(title) + '</h1>' : "") +
      '<img src="' + imageData + '" alt="table export" /></div></body></html>'
    );
    win.document.close();
    win.focus();
    win.onload = function () {
      win.print();
      setTimeout(function () { win.close(); }, 400);
    };
  }

  function filterRowsByDimensionFilters(rows, dimensionFilters) {
    return rows.filter(function (row) {
      return Object.keys(dimensionFilters).every(function (fieldId) {
        if (state.dimensionFilterFields.length && !state.dimensionFilterFields.includes(fieldId)) return true;
        const selectedValues = dimensionFilters[fieldId] || [];
        if (!selectedValues.length) return true;
        return selectedValues.includes(row.dimensions[fieldId] || "鏈爣娉?");
      });
    });
  }

  function renderDimensionFieldPill(field, selected) {
    return '<button class="pill ' + (selected ? "selected experiment" : "") + '" type="button" data-toggle-dimension-field="' + escapeHtml(field.id) + '">' + escapeHtml(field.label) + "</button>";
  }

  function getOrderedFormulaConfigs(schema) {
    const configs = (schema && schema.formulaMetricConfigs ? schema.formulaMetricConfigs : state.formulaOverrides) || [];
    return configs.slice().sort(function (left, right) {
      return (left.order || 0) - (right.order || 0);
    });
  }

  function createCustomFormulaConfig() {
    const nextIndex = state.customMetricCounter;
    const nextOrder = (state.formulaOverrides || []).reduce(function (maxOrder, config) {
      return Math.max(maxOrder, Number.isFinite(config.order) ? config.order : 0);
    }, -1) + 1;
    state.customMetricCounter += 1;
    return {
      id: "custom_formula_" + nextIndex,
      presetId: "",
      label: "鑷畾涔夌粺璁￠噺" + nextIndex,
      type: "number",
      formula: "",
      compareToControl: false,
      selected: true,
      isCustom: true,
      order: nextOrder
    };
  }

  function renderFormulaPresetPill(config) {
    const selected = config.selected !== false;
    const suffix = selected ? " 路 宸插惎鐢?" : " 路 鐐瑰嚮娣诲姞";
    return '<button class="pill ' + (selected ? "selected control" : "") + '" type="button" data-toggle-formula-preset="' + escapeHtml(config.id) + '">' + escapeHtml(config.label + suffix) + "</button>";
  }

  function renderFormulaCard(config, schema) {
    const availableMetricRefs = schema.baseMetrics
      .map(function (metric) { return "{" + metric.label + "}"; })
      .concat(
        getOrderedFormulaConfigs(schema)
          .filter(function (item) { return item.selected && item.id !== config.id; })
          .map(function (item) { return "{" + item.label + "}"; })
      );
    const availableDimensions = schema.dimensionFields.map(function (field) { return field.label; });
    const warnings = config.validation && config.validation.warnings ? config.validation.warnings : [];
    const metaLabel = config.isCustom ? "鑷畾涔夌粺璁￠噺" : "棰勭疆缁熻閲?";
    const actionLabel = config.isCustom ? "鍒犻櫎" : "鍋滅敤";
    const actionMode = config.isCustom ? "delete" : "disable";

    return (
      '<article class="formula-card" data-formula-config-card="' + escapeHtml(config.id) + '" data-preset-id="' + escapeHtml(config.presetId || "") + '" data-is-custom="' + (config.isCustom ? "true" : "false") + '" data-order="' + escapeHtml(config.order || 0) + '">' +
      '<div class="formula-card-head"><div><strong>' + escapeHtml(config.label) + '</strong><div class="muted">' + escapeHtml(metaLabel) + "</div></div>" +
      '<button type="button" class="button-ghost mini" data-remove-formula-config="' + escapeHtml(config.id) + '" data-remove-mode="' + actionMode + '">' + actionLabel + "</button></div>" +
      '<div class="formula-form-grid">' +
      '<label class="field"><span>缁熻閲忓悕绉?/span><input type="text" data-formula-label="' + escapeHtml(config.id) + '" value="' + escapeHtml(config.label) + '" placeholder="渚嬪锛氱偣鍑荤巼 / CVR / GMV" /></label>' +
      '<label class="field"><span>灞曠ず鏍煎紡</span><select data-formula-type="' + escapeHtml(config.id) + '">' +
      '<option value="number"' + (config.type === "number" ? " selected" : "") + '>鏁板€?/option>' +
      '<option value="percent"' + (config.type === "percent" ? " selected" : "") + '>鐧惧垎姣?/option>' +
      '</select></label></div>' +
      '<label class="field"><span>璁＄畻鍏紡</span><textarea rows="3" data-formula-expression="' + escapeHtml(config.id) + '" placeholder="{璁㈠崟閲?} / {UV} * 100 鎴?VLOOKUP(&quot;瀛︾&quot;, &quot;鏁板&quot;, &quot;GMV&quot;)">' + escapeHtml(config.formula || "") + "</textarea></label>" +
      '<div class="formula-meta">' +
      '<div class="field-note">可引用指标：' + escapeHtml(availableMetricRefs.length ? availableMetricRefs.join(" / ") : "暂无") + "</div>" +
      '<div class="field-note">可查找维度：' + escapeHtml(availableDimensions.length ? availableDimensions.join(" / ") : "暂无") + "</div>" +
      '<div class="field-note">支持 + - * /，也支持 VLOOKUP("维度字段", "匹配值", "返回指标")。</div>' +
      warnings.map(function (warning) {
        return '<div class="field-note error">' + escapeHtml(warning) + "</div>";
      }).join("") +
      "</div>" +
      '<div class="formula-card-actions"><label class="formula-compare-toggle"><input type="checkbox" data-formula-compare="' + escapeHtml(config.id) + '"' + (config.compareToControl ? " checked" : "") + ' /><span>算环比</span></label></div></article>'
    );
  }

/*
  function renderDimensionFilterBlocks(schema, rows) {
    if (!schema.dimensionFields.length) return "";

    const activeFieldIds = state.dimensionFilterFields.filter(function (fieldId) {
      return schema.dimensionFields.some(function (field) { return field.id === fieldId; });
    });
    const activeFields = schema.dimensionFields.filter(function (field) {
      return activeFieldIds.includes(field.id);
    });

    return (
      '<div class="filter-block"><div class="filter-head"><strong>缁村害鍊肩瓫閫?/strong><span class="muted">鍏堥€夎绛涚殑缁村害瀛楁锛屽啀閫夋兂淇濈暀鐨勭被鍒€?/span></div>' +
      '<div class="dimension-field-picker">' +
      schema.dimensionFields.map(function (field) {
        return renderDimensionFieldPill(field, activeFieldIds.includes(field.id));
      }).join("") +
      "</div>" +
      (activeFields.length
        ? activeFields.map(function (field) {
            const values = unique(rows.map(function (row) {
              return row.dimensions[field.id] || "鏈爣娉?";
            }));
            const selectedValues = state.dimensionFilters[field.id] || [];
            return (
              '<div class="dimension-filter-card"><div class="filter-head"><strong>' + escapeHtml(field.label) + '</strong><span class="muted">' +
              escapeHtml(selectedValues.length ? ("宸查€?" + selectedValues.length + " 椤?) : "榛樿鍏ㄩ儴") +
              '</span></div><div class="button-row">' +
              '<button type="button" class="button-ghost mini" data-dimension-select-all="' + field.id + '">鍏ㄩ儴</button>' +
              '<button type="button" class="button-ghost mini" data-dimension-clear="' + field.id + '">娓呯┖</button>' +
              "</div><div class=\"pill-row\">" +
              values.map(function (value) {
                return renderDimensionValuePill(field.id, value, selectedValues.includes(value));
              }).join("") +
              "</div></div>"
            );
          }).join("")
        : '<div class="empty inline-empty"><div><strong>鍏堜粠涓婇潰閫夋嫨缁村害瀛楁</strong><p class="muted">鍒板簳琛ㄩ噷鍙琚瘑鍒负缁村害鐨勮〃澶达紝閮藉彲浠ュ湪杩欓噷寮€鍚瓫閫夈€?/p></div></div>') +
      "</div>"
    );
  }

  function renderFormulaEditor(schema) {
    const formulaConfigs = getOrderedFormulaConfigs(schema);
    const presetConfigs = formulaConfigs.filter(function (config) { return Boolean(config.presetId); });
    const activeConfigs = formulaConfigs.filter(function (config) { return config.selected; });
    const ratioFormula = "((本实验组该统计量 / 对照组该统计量) - 1) * 100";

    return (
      '<div class="filter-block formula-workbench"><div class="filter-head"><strong>缁熻閲忎笌鍏紡</strong><span class="muted">鍏堥€夎鐪嬬殑缁熻閲忥紝鍐嶄负瀹冮厤缃叕寮忋€傜己鍙橀噺鏃朵細鍦ㄥ崱鐗囧簳閮ㄧ敤绾㈣壊鎻愮ず銆?/span></div>' +
      '<div class="formula-toolbar">' +
      '<div class="formula-preset-row">' +
      presetConfigs.map(function (config) {
        return renderFormulaPresetPill(config);
      }).join("") +
      "</div>" +
      '<div class="button-row"><button type="button" class="button-ghost" id="addCustomMetricBtn">鏂板鑷畾涔夌粺璁￠噺</button></div>' +
      "</div>" +
      '<div class="formula-reference-box">' +
      '<div class="field-note"><strong>已识别底层指标：</strong> ' + escapeHtml(schema.baseMetrics.map(function (metric) { return metric.label; }).join(" / ")) + "</div>" +
      '<div class="field-note"><strong>已识别维度：</strong> ' + escapeHtml(schema.dimensionFields.length ? schema.dimensionFields.map(function (field) { return field.label; }).join(" / ") : "暂无") + "</div>" +
      "</div>" +
      '<div class="formula-reference-box formula-helper-box">' +
      '<div class="field-note"><strong>环比算法（实验组 vs 对照组）</strong></div>' +
      '<div class="field-note">公式：((本实验组该统计量 / 对照组该统计量) - 1) * 100</div>' +
      '<div class="field-note">展示口径：结果转成百分比，并保留小数点后两位。</div>' +
      '<div class="field-note">当前表格里的 lift / 提升率就是按这个口径计算的。</div>' +
      "</div>" +
      '<div class="formula-reference-box formula-helper-box">' +
      '<div class="field-note"><strong>环比算法（实验组 vs 对照组）</strong></div>' +
      '<div class="field-note">公式：((本实验组该统计量 / 对照组该统计量) - 1) * 100</div>' +
      '<div class="field-note">展示口径：结果转成百分比，并保留小数点后两位。</div>' +
      '<div class="field-note">当前表格里的 lift / 提升率就是按这个口径计算的。</div>' +
      "</div>" +
      (activeConfigs.length
        ? '<div class="formula-grid">' + activeConfigs.map(function (config) {
            return renderFormulaCard(config, schema);
          }).join("") + "</div>"
        : '<div class="empty inline-empty"><div><strong>杩樻病鏈夊惎鐢ㄧ粺璁￠噺</strong><p class="muted">鍙互鍏堢偣涓婇潰鐨勯缃寚鏍囷紝涔熷彲浠ユ柊澧炶嚜瀹氫箟缁熻閲忋€?/p></div></div>') +
      '<div class="formula-reference-box formula-helper-box">' +
      '<div class="field-note"><strong>环比算法（实验组 vs 对照组）：</strong>' + escapeHtml(ratioFormula) + "</div>" +
      '<div class="field-note"><strong>展示格式：</strong>结果转成百分比，并保留小数点后两位。</div>' +
      '<div class="field-note"><strong>适用场景：</strong>用于看实验组相对对照组的变化幅度，和表格里的提升率口径一致。</div>' +
      "</div>" +
      '<div class="formula-reference-box formula-helper-box">' +
      '<div class="field-note"><strong>环比算法（实验组 vs 对照组）：</strong>' + escapeHtml(ratioFormula) + "</div>" +
      '<div class="field-note"><strong>展示格式：</strong>结果转成百分比，并保留小数点后两位。</div>' +
      '<div class="field-note"><strong>适用场景：</strong>用于看实验组相对对照组的变化幅度，和表格里的提升率口径一致。</div>' +
      "</div>" +
      '<div class="button-row" style="margin-top:10px;"><button type="button" class="button-ghost" id="applyFormulaBtn">搴旂敤缁熻閲忛厤缃?/button></div></div>'
    );
  }

  function renderSchemaPills(schema) {
    const parts = [
      "瀹為獙瀛楁锛? + formatFieldBadge(schema.experimentField, schema.roleChoices.experimentField),
      "鏃ユ湡瀛楁锛? + formatFieldBadge(schema.dateField, schema.roleChoices.dateField),
      "鍒嗙粍瀛楁锛? + formatFieldBadge(schema.groupField, schema.roleChoices.groupField),
      "鍒嗙粍绫诲瀷瀛楁锛? + formatFieldBadge(schema.groupTypeField, schema.roleChoices.groupTypeField),
      "维度字段：" + (schema.dimensionFields.length ? schema.dimensionFields.map(function (field) { return field.label; }).join(" / ") : "无"),
      "指标字段：" + schema.metrics.map(function (metric) { return metric.label; }).join(" / ")
    ];

    return parts.map(function (item) {
      return '<span class="pill schema-pill" style="cursor:default;">' + escapeHtml(item) + "</span>";
    }).join("");
  }

  function renderFilterPanel(schema, scope, matchedExperimentIds, experimentHint, dateFilteredRows) {
    const hasManualOverrides = Object.keys(state.fieldOverrides).some(function (key) {
      return Boolean(state.fieldOverrides[key]);
    });

    return (
      '<section class="panel">' +
      '<div class="panel-head"><div><p class="eyebrow">鏅鸿兘璇嗗埆</p><h2>瀛楁瑙掕壊涓庣瓫閫夊櫒</h2>' +
      '<div class="subtitle">鎴戜細鍏堣嚜鍔ㄦ帹鏂瓧娈佃鑹诧紱濡傛灉璇嗗埆鍋忎簡锛屼綘涔熷彲浠ュ湪涓嬮潰鐩存帴绾犲亸锛屼笉鐢ㄦ敼鍘熷鍒楀悕銆?' +
      (hasManualOverrides ? " 褰撳墠宸插惎鐢ㄦ墜鍔ㄧ籂鍋忋€?" : "") +
      '</div></div><div class="button-row"><button class="button-ghost" type="button" id="resetRecognitionBtn">鎭㈠鑷姩璇嗗埆</button></div></div>' +
      '<div class="recognition-grid">' +
      renderRecognitionCard("瀹為獙瀛楁", schema.experimentField, schema.roleChoices.experimentField, getColumnSamples(schema, schema.experimentField)) +
      renderRecognitionCard("鏃ユ湡瀛楁", schema.dateField, schema.roleChoices.dateField, getColumnSamples(schema, schema.dateField)) +
      renderRecognitionCard("鍒嗙粍瀛楁", schema.groupField, schema.roleChoices.groupField, getColumnSamples(schema, schema.groupField)) +
      renderRecognitionCard("鍒嗙粍绫诲瀷", schema.groupTypeField || "鏈寚瀹?, schema.roleChoices.groupTypeField, getColumnSamples(schema, schema.groupTypeField)) +
      renderRecognitionCard("缁村害瀛楁", schema.dimensionFields.length + " 涓?, { source: "auto", score: schema.dimensionFields.length ? 90 : 0 }, schema.dimensionFields.map(function (field) { return field.label; }).slice(0, 4)) +
      renderRecognitionCard("鎸囨爣瀛楁", schema.metrics.length + " 涓?, { source: "auto", score: schema.metrics.length ? 90 : 0 }, schema.metrics.map(function (metric) { return metric.label; }).slice(0, 4)) +
      "</div>" +
      '<div class="recognition-editor">' +
      renderFieldSelect(schema, "experimentField", "瀹為獙瀛楁", true) +
      renderFieldSelect(schema, "dateField", "鏃ユ湡瀛楁", true) +
      renderFieldSelect(schema, "groupField", "鍒嗙粍瀛楁", false) +
      renderFieldSelect(schema, "groupTypeField", "鍒嗙粍绫诲瀷", true) +
      "</div>" +
      '<div class="message warning" style="margin-top:16px;margin-bottom:16px;"><strong>宸茶瘑鍒?schema</strong><div class="schema-scroll">' +
      renderSchemaPills(schema) +
      "</div></div>" +
      renderColumnProfileTable(schema) +
      '<div class="filters-grid">' +
      '<label class="field"><span>瀹為獙</span>' +
      '<input id="experimentQueryInput" list="experimentIdOptions" value="' + escapeHtml(state.experimentQuery) + '" placeholder="杈撳叆瀹為獙缂栧彿鎴栧叧閿瓧" />' +
      (experimentHint ? '<small class="field-note' + (matchedExperimentIds.length ? "" : " error") + '">' + escapeHtml(experimentHint) + "</small>" : "") +
      '<datalist id="experimentIdOptions">' +
      matchedExperimentIds.map(function (id) {
        return '<option value="' + escapeHtml(id) + '"></option>';
      }).join("") +
      "</datalist></label>" +
      (schema.dateField
        ? '<label class="field"><span>寮€濮嬫棩鏈?/span><input id="startDateInput" type="date" min="' + escapeHtml(scope.minDate) + '" max="' + escapeHtml(state.dateRange.end || scope.maxDate) + '" value="' + escapeHtml(state.dateRange.start) + '" /></label>' +
          '<label class="field"><span>缁撴潫鏃ユ湡</span><input id="endDateInput" type="date" min="' + escapeHtml(state.dateRange.start || scope.minDate) + '" max="' + escapeHtml(scope.maxDate) + '" value="' + escapeHtml(state.dateRange.end) + '" /></label>'
        : '<div class="field"><span>鏃ユ湡瀛楁</span><div class="field-note">鏈瘑鍒棩鏈熷垪锛岃秼鍔垮浘浼氳嚜鍔ㄩ殣钘忋€?/div></div><div class="field"><span>鏃ユ湡绛涢€?/span><div class="field-note">鏃犳棩鏈熷瓧娈垫椂榛樿灞曠ず鍏ㄩ噺鏁版嵁銆?/div></div>') +
      '<div class="field"><span>鏁版嵁鍙ｅ緞</span><div class="segment">' +
      renderSegmentButton("summary", "姹囨€绘暟鎹?, state.caliber) +
      renderSegmentButton("daily_avg", "鏃ュ潎鏁版嵁", state.caliber) +
      "</div></div></div>" +
      renderGroupSelectionEditor(scope) +
      renderFormulaEditor(schema) +
      renderDimensionFilterBlocks(schema, dateFilteredRows) +
      "</section>"
    );
  }

*/

  function renderDimensionFilterBlocks(schema, rows) {
    if (!schema.dimensionFields.length) return "";

    const activeFieldIds = state.dimensionFilterFields.filter(function (fieldId) {
      return schema.dimensionFields.some(function (field) { return field.id === fieldId; });
    });
    const activeFields = schema.dimensionFields.filter(function (field) {
      return activeFieldIds.includes(field.id);
    });

    return (
      '<div class="filter-block"><div class="filter-head"><strong>维度值筛选</strong><span class="muted">先选要筛的维度字段，再选想保留的类别。</span></div>' +
      '<div class="dimension-field-picker">' +
      schema.dimensionFields.map(function (field) {
        return renderDimensionFieldPill(field, activeFieldIds.includes(field.id));
      }).join("") +
      "</div>" +
      (activeFields.length
        ? activeFields.map(function (field) {
            const values = unique(rows.map(function (row) {
              return row.dimensions[field.id] || "未标注";
            }));
            const selectedValues = state.dimensionFilters[field.id] || [];
            return (
              '<div class="dimension-filter-card"><div class="filter-head"><strong>' + escapeHtml(field.label) + '</strong><span class="muted">' +
              escapeHtml(selectedValues.length ? ("已选 " + selectedValues.length + " 项") : "默认全部") +
              '</span></div><div class="button-row">' +
              '<button type="button" class="button-ghost mini" data-dimension-select-all="' + field.id + '">全部</button>' +
              '<button type="button" class="button-ghost mini" data-dimension-clear="' + field.id + '">清空</button>' +
              "</div><div class=\"pill-row\">" +
              values.map(function (value) {
                return renderDimensionValuePill(field.id, value, selectedValues.includes(value));
              }).join("") +
              "</div></div>"
            );
          }).join("")
        : '<div class="empty inline-empty"><div><strong>先从上面选择维度字段</strong><p class="muted">只要被识别成维度的表头，都可以在这里开启筛选。</p></div></div>') +
      "</div>"
    );
  }

  function renderFormulaEditor(schema) {
    const formulaConfigs = getOrderedFormulaConfigs(schema);
    const presetConfigs = formulaConfigs.filter(function (config) { return Boolean(config.presetId); });
    const activeConfigs = formulaConfigs.filter(function (config) { return config.selected; });

    return (
      '<div class="filter-block formula-workbench"><div class="filter-head"><strong>统计量与公式</strong><span class="muted">先选要看的统计量，再给它配置公式。缺变量时会在卡片底部直接提醒。</span></div>' +
      '<div class="formula-toolbar">' +
      '<div class="formula-preset-row">' +
      presetConfigs.map(function (config) {
        return renderFormulaPresetPill(config);
      }).join("") +
      "</div>" +
      '<div class="button-row"><button type="button" class="button-ghost" id="addCustomMetricBtn">新增自定义统计量</button></div>' +
      "</div>" +
      '<div class="formula-reference-box">' +
      '<div class="field-note"><strong>已识别底层指标：</strong> ' + escapeHtml(schema.baseMetrics.map(function (metric) { return metric.label; }).join(" / ")) + "</div>" +
      '<div class="field-note"><strong>已识别维度：</strong> ' + escapeHtml(schema.dimensionFields.length ? schema.dimensionFields.map(function (field) { return field.label; }).join(" / ") : "暂无") + "</div>" +
      "</div>" +
      (activeConfigs.length
        ? '<div class="formula-grid">' + activeConfigs.map(function (config) {
            return renderFormulaCard(config, schema);
          }).join("") + "</div>"
        : '<div class="empty inline-empty"><div><strong>还没有启用统计量</strong><p class="muted">可以先点上面的预置指标，也可以新增一个自定义统计量。</p></div></div>') +
      '<div class="formula-reference-box formula-helper-box">' +
      '<div class="field-note"><strong>环比算法（实验组 vs 对照组）：</strong>' + escapeHtml(ratioFormula) + "</div>" +
      '<div class="field-note"><strong>展示格式：</strong>结果转成百分比，并保留小数点后两位。</div>' +
      '<div class="field-note"><strong>适用场景：</strong>用于看实验组相对对照组的变化幅度，和表格里的提升率口径一致。</div>' +
      "</div>" +
      '<div class="formula-reference-box formula-helper-box">' +
      '<div class="field-note"><strong>环比算法（实验组 vs 对照组）：</strong>' + escapeHtml(ratioFormula) + "</div>" +
      '<div class="field-note"><strong>展示格式：</strong>结果转成百分比，并保留小数点后两位。</div>' +
      '<div class="field-note"><strong>适用场景：</strong>用于看实验组相对对照组的变化幅度，和表格里的提升率口径一致。</div>' +
      "</div>" +
      '<div class="button-row" style="margin-top:10px;"><button type="button" class="button-ghost" id="applyFormulaBtn">应用统计量配置</button></div></div>'
    );
  }

  function renderSchemaPills(schema) {
    const parts = [
      "实验字段：" + formatFieldBadge(schema.experimentField, schema.roleChoices.experimentField),
      "日期字段：" + formatFieldBadge(schema.dateField, schema.roleChoices.dateField),
      "分组字段：" + formatFieldBadge(schema.groupField, schema.roleChoices.groupField),
      "分组类型字段：" + formatFieldBadge(schema.groupTypeField, schema.roleChoices.groupTypeField),
      "维度字段：" + (schema.dimensionFields.length ? schema.dimensionFields.map(function (field) { return field.label; }).join(" / ") : "无"),
      "指标字段：" + schema.metrics.map(function (metric) { return metric.label; }).join(" / ")
    ];

    return parts.map(function (item) {
      return '<span class="pill schema-pill" style="cursor:default;">' + escapeHtml(item) + "</span>";
    }).join("");
  }

  function renderFilterPanel(schema, scope, matchedExperimentIds, experimentHint, dateFilteredRows) {
    const hasManualOverrides = Object.keys(state.fieldOverrides).some(function (key) {
      return Boolean(state.fieldOverrides[key]);
    });

    return (
      '<section class="panel">' +
      '<div class="panel-head"><div><p class="eyebrow">智能识别</p><h2>字段角色与筛选器</h2>' +
      '<div class="subtitle">我会先自动推断字段角色；如果识别偏了，你也可以在下面直接纠偏，不用改原始列名。' +
      (hasManualOverrides ? " 当前已启用手动纠偏。" : "") +
      '</div></div><div class="button-row"><button class="button-ghost" type="button" id="resetRecognitionBtn">恢复自动识别</button></div></div>' +
      '<div class="recognition-grid">' +
      renderRecognitionCard("实验字段", schema.experimentField, schema.roleChoices.experimentField, getColumnSamples(schema, schema.experimentField)) +
      renderRecognitionCard("日期字段", schema.dateField, schema.roleChoices.dateField, getColumnSamples(schema, schema.dateField)) +
      renderRecognitionCard("分组字段", schema.groupField, schema.roleChoices.groupField, getColumnSamples(schema, schema.groupField)) +
      renderRecognitionCard("分组类型", schema.groupTypeField || "未指定", schema.roleChoices.groupTypeField, getColumnSamples(schema, schema.groupTypeField)) +
      renderRecognitionCard("维度字段", schema.dimensionFields.length + " 个", { source: "auto", score: schema.dimensionFields.length ? 90 : 0 }, schema.dimensionFields.map(function (field) { return field.label; }).slice(0, 4)) +
      renderRecognitionCard("指标字段", schema.metrics.length + " 个", { source: "auto", score: schema.metrics.length ? 90 : 0 }, schema.metrics.map(function (metric) { return metric.label; }).slice(0, 4)) +
      "</div>" +
      '<div class="recognition-editor">' +
      renderFieldSelect(schema, "experimentField", "实验字段", true) +
      renderFieldSelect(schema, "dateField", "日期字段", true) +
      renderFieldSelect(schema, "groupField", "分组字段", false) +
      renderFieldSelect(schema, "groupTypeField", "分组类型", true) +
      "</div>" +
      '<div class="message warning" style="margin-top:16px;margin-bottom:16px;"><strong>已识别 schema</strong><div class="schema-scroll">' +
      renderSchemaPills(schema) +
      "</div></div>" +
      renderColumnProfileTable(schema) +
      '<div class="filters-grid">' +
      '<label class="field"><span>实验</span>' +
      '<input id="experimentQueryInput" list="experimentIdOptions" value="' + escapeHtml(state.experimentQuery) + '" placeholder="输入实验编号或关键词" />' +
      (experimentHint ? '<small class="field-note' + (matchedExperimentIds.length ? "" : " error") + '">' + escapeHtml(experimentHint) + "</small>" : "") +
      '<datalist id="experimentIdOptions">' +
      matchedExperimentIds.map(function (id) {
        return '<option value="' + escapeHtml(id) + '"></option>';
      }).join("") +
      "</datalist></label>" +
      (schema.dateField
        ? '<label class="field"><span>开始日期</span><input id="startDateInput" type="date" min="' + escapeHtml(scope.minDate) + '" max="' + escapeHtml(state.dateRange.end || scope.maxDate) + '" value="' + escapeHtml(state.dateRange.start) + '" /></label>' +
          '<label class="field"><span>结束日期</span><input id="endDateInput" type="date" min="' + escapeHtml(state.dateRange.start || scope.minDate) + '" max="' + escapeHtml(scope.maxDate) + '" value="' + escapeHtml(state.dateRange.end) + '" /></label>'
        : '<div class="field"><span>日期字段</span><div class="field-note">未识别到日期列，趋势图会自动隐藏。</div></div><div class="field"><span>日期筛选</span><div class="field-note">无日期字段时默认展示全量数据。</div></div>') +
      '<div class="field"><span>数据口径</span><div class="segment">' +
      renderSegmentButton("summary", "汇总数据", state.caliber) +
      renderSegmentButton("daily_avg", "日均数据", state.caliber) +
      "</div></div></div>" +
      renderGroupSelectionEditor(scope) +
      renderFormulaEditor(schema) +
      renderDimensionFilterBlocks(schema, dateFilteredRows) +
      "</section>"
    );
  }

  function updateFormulaConfigs(nextConfigs) {
    state.formulaOverrides = nextConfigs.slice().sort(function (left, right) {
      return (left.order || 0) - (right.order || 0);
    });
    rebuildFromRawRows();
  }

  function collectFormulaOverridesFromEditor() {
    const configMap = {};
    getOrderedFormulaConfigs(state.schema).forEach(function (config) {
      configMap[config.id] = Object.assign({}, config);
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-formula-config-card]"), function (card) {
      const configId = card.getAttribute("data-formula-config-card");
      const labelInput = document.querySelector('[data-formula-label="' + configId + '"]');
      const typeSelect = document.querySelector('[data-formula-type="' + configId + '"]');
      const expressionInput = document.querySelector('[data-formula-expression="' + configId + '"]');
      const compareInput = document.querySelector('[data-formula-compare="' + configId + '"]');
      const existing = configMap[configId] || {};
      configMap[configId] = {
        id: configId,
        presetId: card.getAttribute("data-preset-id") || existing.presetId || "",
        label: labelInput && String(labelInput.value).trim() ? String(labelInput.value).trim() : (existing.label || "鑷畾涔夌粺璁￠噺"),
        type: typeSelect && typeSelect.value === "percent" ? "percent" : "number",
        formula: expressionInput ? String(expressionInput.value || "").trim() : (existing.formula || ""),
        compareToControl: compareInput ? Boolean(compareInput.checked) : Boolean(existing.compareToControl),
        selected: true,
        isCustom: card.getAttribute("data-is-custom") === "true" || existing.isCustom,
        order: Number(card.getAttribute("data-order"))
      };
    });

    return Object.keys(configMap).map(function (configId) {
      const config = configMap[configId];
      return {
        id: config.id,
        presetId: config.presetId || "",
        label: config.label,
        type: config.type,
        formula: config.formula,
        compareToControl: Boolean(config.compareToControl),
        selected: config.selected !== false,
        isCustom: Boolean(config.isCustom),
        order: Number.isFinite(config.order) ? config.order : 0
      };
    }).sort(function (left, right) {
      return (left.order || 0) - (right.order || 0);
    });
  }

  function bindExtraDashboardEvents(scope) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-dimension-field]"), function (button) {
      button.addEventListener("click", function () {
        const fieldId = button.getAttribute("data-toggle-dimension-field");
        if (state.dimensionFilterFields.includes(fieldId)) {
          state.dimensionFilterFields = state.dimensionFilterFields.filter(function (item) { return item !== fieldId; });
          state.dimensionFilters[fieldId] = [];
        } else {
          state.dimensionFilterFields = state.dimensionFilterFields.concat(fieldId);
        }
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-formula-preset]"), function (button) {
      button.addEventListener("click", function () {
        const configId = button.getAttribute("data-toggle-formula-preset");
        const nextConfigs = getOrderedFormulaConfigs(state.schema).map(function (config) {
          if (config.id !== configId) return Object.assign({}, config);
          const toggled = Object.assign({}, config, { selected: !config.selected });
          if (toggled.selected && !toggled.formula && toggled.presetId) {
            toggled.formula = getDefaultFormulaForPreset(toggled.presetId, state.schema.baseMetrics);
          }
          return toggled;
        });
        try {
          updateFormulaConfigs(nextConfigs);
          state.error = "";
        } catch (error) {
          state.error = error && error.message ? error.message : "缁熻閲忓垏鎹㈠け璐ャ€?";
        }
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-remove-formula-config]"), function (button) {
      button.addEventListener("click", function () {
        const configId = button.getAttribute("data-remove-formula-config");
        const removeMode = button.getAttribute("data-remove-mode");
        const nextConfigs = getOrderedFormulaConfigs(state.schema)
          .filter(function (config) {
            return !(removeMode === "delete" && config.id === configId);
          })
          .map(function (config) {
            if (removeMode === "disable" && config.id === configId) {
              return Object.assign({}, config, { selected: false });
            }
            return Object.assign({}, config);
          });
        try {
          updateFormulaConfigs(nextConfigs);
          state.error = "";
        } catch (error) {
          state.error = error && error.message ? error.message : "缁熻閲忔洿鏂板け璐ャ€?";
        }
        render();
      });
    });

    const addCustomMetricBtn = document.getElementById("addCustomMetricBtn");
    if (addCustomMetricBtn) {
      addCustomMetricBtn.addEventListener("click", function () {
        const nextConfigs = getOrderedFormulaConfigs(state.schema).concat(createCustomFormulaConfig());
        try {
          updateFormulaConfigs(nextConfigs);
          state.error = "";
        } catch (error) {
          state.error = error && error.message ? error.message : "鏂板缁熻閲忓け璐ャ€?";
        }
        render();
      });
    }

    const applyFormulaBtn = document.getElementById("applyFormulaBtn");
    if (applyFormulaBtn && document.querySelectorAll("[data-formula-config-card]").length) {
      applyFormulaBtn.addEventListener("click", function () {
        try {
          updateFormulaConfigs(collectFormulaOverridesFromEditor());
          state.error = "";
        } catch (error) {
          state.error = error && error.message ? error.message : "鍏紡搴旂敤澶辫触銆?";
        }
        render();
      });
    }
  }

  function renderDimensionFilterBlocks(schema, rows) {
    if (!schema.dimensionFields.length) return "";

    const activeFieldIds = state.dimensionFilterFields.filter(function (fieldId) {
      return schema.dimensionFields.some(function (field) { return field.id === fieldId; });
    });
    const activeFields = schema.dimensionFields.filter(function (field) {
      return activeFieldIds.includes(field.id);
    });

    return (
      '<div class="filter-block"><div class="filter-head"><strong>维度值筛选</strong><span class="muted">先选要筛的维度字段，再选想保留的类别。</span></div>' +
      '<div class="dimension-field-picker">' +
      schema.dimensionFields.map(function (field) {
        return renderDimensionFieldPill(field, activeFieldIds.includes(field.id));
      }).join("") +
      "</div>" +
      (activeFields.length
        ? activeFields.map(function (field) {
            const values = unique(rows.map(function (row) {
              return row.dimensions[field.id] || "未标注";
            }));
            const selectedValues = state.dimensionFilters[field.id] || [];
            return (
              '<div class="dimension-filter-card"><div class="filter-head"><strong>' + escapeHtml(field.label) + '</strong><span class="muted">' +
              escapeHtml(selectedValues.length ? ("已选 " + selectedValues.length + " 项") : "默认全部") +
              '</span></div><div class="button-row">' +
              '<button type="button" class="button-ghost mini" data-dimension-select-all="' + field.id + '">全部</button>' +
              '<button type="button" class="button-ghost mini" data-dimension-clear="' + field.id + '">清空</button>' +
              "</div><div class=\"pill-row\">" +
              values.map(function (value) {
                return renderDimensionValuePill(field.id, value, selectedValues.includes(value));
              }).join("") +
              "</div></div>"
            );
          }).join("")
        : '<div class="empty inline-empty"><div><strong>先从上面选择维度字段</strong><p class="muted">只要被识别成维度的表头，都可以在这里开启筛选。</p></div></div>') +
      "</div>"
    );
  }

  function renderFormulaEditor(schema) {
    const formulaConfigs = getOrderedFormulaConfigs(schema);
    const presetConfigs = formulaConfigs.filter(function (config) { return Boolean(config.presetId); });
    const activeConfigs = formulaConfigs.filter(function (config) { return config.selected; });

    return (
      '<div class="filter-block formula-workbench"><div class="filter-head"><strong>统计量与公式</strong><span class="muted">先选要看的统计量，再给它配置公式。缺变量时会在卡片底部直接提醒。</span></div>' +
      '<div class="formula-toolbar">' +
      '<div class="formula-preset-row">' +
      presetConfigs.map(function (config) {
        return renderFormulaPresetPill(config);
      }).join("") +
      "</div>" +
      '<div class="button-row"><button type="button" class="button-ghost" id="addCustomMetricBtn">新增自定义统计量</button></div>' +
      "</div>" +
      '<div class="formula-reference-box">' +
      '<div class="field-note"><strong>已识别底层指标：</strong> ' + escapeHtml(schema.baseMetrics.map(function (metric) { return metric.label; }).join(" / ")) + "</div>" +
      '<div class="field-note"><strong>已识别维度：</strong> ' + escapeHtml(schema.dimensionFields.length ? schema.dimensionFields.map(function (field) { return field.label; }).join(" / ") : "暂无") + "</div>" +
      "</div>" +
      (activeConfigs.length
        ? '<div class="formula-grid">' + activeConfigs.map(function (config) {
            return renderFormulaCard(config, schema);
          }).join("") + "</div>"
        : '<div class="empty inline-empty"><div><strong>还没有启用统计量</strong><p class="muted">可以先点上面的预置指标，也可以新增一个自定义统计量。</p></div></div>') +
      '<div class="button-row" style="margin-top:10px;"><button type="button" class="button-ghost" id="applyFormulaBtn">应用统计量配置</button></div></div>'
    );
  }

  function renderSchemaPills(schema) {
    const parts = [
      "实验字段：" + formatFieldBadge(schema.experimentField, schema.roleChoices.experimentField),
      "日期字段：" + formatFieldBadge(schema.dateField, schema.roleChoices.dateField),
      "分组字段：" + formatFieldBadge(schema.groupField, schema.roleChoices.groupField),
      "分组类型字段：" + formatFieldBadge(schema.groupTypeField, schema.roleChoices.groupTypeField),
      "维度字段：" + (schema.dimensionFields.length ? schema.dimensionFields.map(function (field) { return field.label; }).join(" / ") : "无"),
      "指标字段：" + schema.metrics.map(function (metric) { return metric.label; }).join(" / ")
    ];

    return parts.map(function (item) {
      return '<span class="pill schema-pill" style="cursor:default;">' + escapeHtml(item) + "</span>";
    }).join("");
  }

  function createCustomFormulaConfig() {
    const nextIndex = state.customMetricCounter;
    const nextOrder = (state.formulaOverrides || []).reduce(function (maxOrder, config) {
      return Math.max(maxOrder, Number.isFinite(config.order) ? config.order : 0);
    }, -1) + 1;
    state.customMetricCounter += 1;
    return {
      id: "custom_formula_" + nextIndex,
      presetId: "",
      label: "自定义统计量" + nextIndex,
      type: "number",
      formula: "",
      compareToControl: false,
      selected: true,
      isCustom: true,
      order: nextOrder
    };
  }

  function renderFormulaPresetPill(config) {
    const selected = config.selected !== false;
    return '<button class="pill ' + (selected ? "selected control" : "") + '" type="button" data-toggle-formula-preset="' + escapeHtml(config.id) + '">' + escapeHtml(config.label + (selected ? " · 已启用" : " · 点击添加")) + "</button>";
  }

  function renderFormulaCard(config, schema) {
    const availableMetricRefs = schema.baseMetrics
      .map(function (metric) { return "{" + metric.label + "}"; })
      .concat(
        getOrderedFormulaConfigs(schema)
          .filter(function (item) { return item.selected && item.id !== config.id; })
          .map(function (item) { return "{" + item.label + "}"; })
      );
    const availableDimensions = schema.dimensionFields.map(function (field) { return field.label; });
    const warnings = config.validation && config.validation.warnings ? config.validation.warnings : [];
    const actionLabel = config.isCustom ? "删除" : "停用";
    const actionMode = config.isCustom ? "delete" : "disable";

    return (
      '<article class="formula-card" data-formula-config-card="' + escapeHtml(config.id) + '" data-preset-id="' + escapeHtml(config.presetId || "") + '" data-is-custom="' + (config.isCustom ? "true" : "false") + '" data-order="' + escapeHtml(config.order || 0) + '">' +
      '<div class="formula-card-head"><div><strong>' + escapeHtml(config.label) + '</strong><div class="muted">' + escapeHtml(config.isCustom ? "自定义统计量" : "预置统计量") + "</div></div>" +
      '<button type="button" class="button-ghost mini" data-remove-formula-config="' + escapeHtml(config.id) + '" data-remove-mode="' + actionMode + '">' + actionLabel + "</button></div>" +
      '<div class="formula-form-grid">' +
      '<label class="field"><span>统计量名称</span><input type="text" data-formula-label="' + escapeHtml(config.id) + '" value="' + escapeHtml(config.label) + '" placeholder="例如：点击率 / CVR / GMV" /></label>' +
      '<label class="field"><span>展示格式</span><select data-formula-type="' + escapeHtml(config.id) + '">' +
      '<option value="number"' + (config.type === "number" ? " selected" : "") + '>数值</option>' +
      '<option value="percent"' + (config.type === "percent" ? " selected" : "") + '>百分比</option>' +
      '</select></label></div>' +
      '<label class="field"><span>计算公式</span><textarea rows="3" data-formula-expression="' + escapeHtml(config.id) + '" placeholder="{订单量} / {UV} * 100 或 VLOOKUP(&quot;学科&quot;, &quot;数学&quot;, &quot;GMV&quot;)">' + escapeHtml(config.formula || "") + "</textarea></label>" +
      '<div class="formula-meta">' +
      '<div class="field-note">可引用指标：' + escapeHtml(availableMetricRefs.length ? availableMetricRefs.join(" / ") : "暂无") + "</div>" +
      '<div class="field-note">可查找维度：' + escapeHtml(availableDimensions.length ? availableDimensions.join(" / ") : "暂无") + "</div>" +
      '<div class="field-note">支持 + - * /，也支持 VLOOKUP("维度字段", "匹配值", "返回指标")。</div>' +
      warnings.map(function (warning) {
        return '<div class="field-note error">' + escapeHtml(warning) + "</div>";
      }).join("") +
      '</div><div class="formula-card-actions"><label class="formula-compare-toggle"><input type="checkbox" data-formula-compare="' + escapeHtml(config.id) + '"' + (config.compareToControl ? " checked" : "") + ' /><span>算环比</span></label></div></article>'
    );
  }

  function renderTrendSvg(schema, trendBundle, visibleSeriesKeys) {
    const metric = schema.metrics.find(function (item) {
      return item.id === state.trendMetric;
    });
    const chartType = state.trendChartType || "line";
    if (chartType === "bar") {
      return renderTrendBarSvg(schema, trendBundle, visibleSeriesKeys, metric);
    }
    if (chartType === "pie") {
      return renderTrendPieSvg(schema, trendBundle, visibleSeriesKeys, metric);
    }
    return renderTrendLineSvg(schema, trendBundle, visibleSeriesKeys, metric);
  }

  function renderTrendLineSvg(schema, trendBundle, visibleSeriesKeys, metric) {
    const data = trendBundle.data;
    const width = 960;
    const padding = { top: 16, right: 18, bottom: 42, left: 68 };
    const innerHeight = computeTrendLineInnerHeight(state.trendZoomScale);
    const height = padding.top + padding.bottom + innerHeight;
    const innerWidth = width - padding.left - padding.right;
    const values = collectTrendMetricValues(data, visibleSeriesKeys, state.trendMetric);
    const domain = computeYAxisDomain(data, visibleSeriesKeys, state.trendMetric);
    const minY = domain[0];
    const maxY = domain[1];
    const xStep = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth / 2;
    const yTicks = buildTrendYAxisTicks(domain, values, padding, innerHeight, computeTrendLineTickCount(innerHeight));
    const gridLines = renderTrendYAxisGrid(yTicks, metric, padding.left, width - padding.right);
    const xLabels = renderTrendXAxisLabels(data, trendBundle.xFieldId, height, padding, xStep, 0);

    let plottedPointCount = 0;
    const seriesPaths = trendBundle.seriesMeta.map(function (series, index) {
      if (!visibleSeriesKeys.includes(series.key)) return "";
      const points = data.map(function (point, pointIndex) {
        const value = point[getSeriesMetricKey(series.key, state.trendMetric)];
        if (typeof value !== "number" || !Number.isFinite(value)) return null;
        return {
          x: padding.left + xStep * pointIndex,
          y: projectTrendY(value, minY, maxY, padding, innerHeight),
          value: value,
          xValue: point.xValue
        };
      });
      const segments = splitPointSegments(points);
      const drawablePoints = points.filter(Boolean);
      if (!drawablePoints.length) return "";
      plottedPointCount += drawablePoints.length;

      const paths = segments.map(function (segment) {
        const path = segment.map(function (point, pointIndex) {
          return (pointIndex === 0 ? "M" : "L") + point.x.toFixed(2) + " " + point.y.toFixed(2);
        }).join(" ");
        return '<path d="' + path + '" fill="none" stroke="' + SERIES_COLORS[index % SERIES_COLORS.length] + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>';
      }).join("");

      const dots = drawablePoints.map(function (point) {
        return (
          '<circle cx="' + point.x.toFixed(2) + '" cy="' + point.y.toFixed(2) + '" r="3.5" fill="' + SERIES_COLORS[index % SERIES_COLORS.length] + '"><title>' +
          escapeHtml(series.label + " | " + formatXAxisTooltip(trendBundle.xFieldId, point.xValue) + " | " + formatTrendMetric(metric, point.value)) +
          "</title></circle>"
        );
      }).join("");

      const lastPoint = drawablePoints[drawablePoints.length - 1];
      const endLabel = lastPoint
        ? '<text x="' + Math.min(width - padding.right, lastPoint.x + 10).toFixed(2) + '" y="' + Math.max(padding.top + 12, lastPoint.y - 10).toFixed(2) + '" font-size="12" fill="' + SERIES_COLORS[index % SERIES_COLORS.length] + '">' + escapeHtml(series.label) + "</text>"
        : "";

      return paths + dots + endLabel;
    }).join("");

    const empty = !visibleSeriesKeys.length
      ? '<text x="' + width / 2 + '" y="' + height / 2 + '" text-anchor="middle" font-size="16" fill="#5d6570">当前没有可见曲线，请点击图例恢复显示</text>'
      : (!plottedPointCount
        ? '<text x="' + width / 2 + '" y="' + height / 2 + '" text-anchor="middle" font-size="16" fill="#5d6570">当前筛选条件下没有有效趋势点位</text>'
        : "");

    return (
      '<svg class="chart-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="趋势图">' +
      gridLines +
      '<line x1="' + padding.left + '" y1="' + (height - padding.bottom) + '" x2="' + (width - padding.right) + '" y2="' + (height - padding.bottom) + '" stroke="rgba(23,33,43,0.16)"></line>' +
      '<line x1="' + padding.left + '" y1="' + padding.top + '" x2="' + padding.left + '" y2="' + (height - padding.bottom) + '" stroke="rgba(23,33,43,0.16)"></line>' +
      xLabels +
      seriesPaths +
      empty +
      "</svg>" +
      '<div class="chart-meta"><span>图表：折线图 / X 轴：' + escapeHtml(getTrendXAxisLabel(schema, trendBundle.xFieldId)) + ' / Y 轴：' + escapeHtml(metric ? getMetricDisplayLabel(metric) : "") + '</span><span>滑动倍数会拉伸折线图高度与刻度密度，但不会改动当前最小值和最大值。</span></div>'
    );
  }

  function renderTrendBarSvg(schema, trendBundle, visibleSeriesKeys, metric) {
    const data = trendBundle.data;
    const width = 960;
    const height = 360;
    const padding = { top: 16, right: 18, bottom: 52, left: 68 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const values = collectTrendMetricValues(data, visibleSeriesKeys, state.trendMetric);
    const domain = computeScaledTrendDomain(
      computeYAxisDomain(data, visibleSeriesKeys, state.trendMetric),
      state.trendZoomScale
    );
    const minY = domain[0];
    const maxY = domain[1];
    const slotWidth = data.length ? innerWidth / data.length : innerWidth;
    const visibleSeries = trendBundle.seriesMeta.filter(function (series) {
      return visibleSeriesKeys.includes(series.key);
    });
    const yTicks = buildTrendYAxisTicks(domain, values, padding, innerHeight);
    const gridLines = renderTrendYAxisGrid(yTicks, metric, padding.left, width - padding.right);
    const xLabels = renderTrendXAxisLabels(data, trendBundle.xFieldId, height, padding, slotWidth, slotWidth / 2);
    let barCount = 0;

    const bars = data.map(function (point, pointIndex) {
      const center = padding.left + slotWidth * pointIndex + slotWidth / 2;
      const bandWidth = Math.min(120, slotWidth * 0.76);
      const barWidth = visibleSeries.length ? Math.max(10, bandWidth / visibleSeries.length - 6) : bandWidth;
      const totalWidth = visibleSeries.length * barWidth + Math.max(0, visibleSeries.length - 1) * 6;
      const startX = center - totalWidth / 2;
      return visibleSeries.map(function (series, seriesIndex) {
        const value = point[getSeriesMetricKey(series.key, state.trendMetric)];
        if (typeof value !== "number" || !Number.isFinite(value)) return "";
        const y = projectTrendY(value, minY, maxY, padding, innerHeight);
        const baseY = projectTrendY(Math.max(0, minY), minY, maxY, padding, innerHeight);
        const heightValue = Math.max(2, baseY - y);
        const x = startX + seriesIndex * (barWidth + 6);
        barCount += 1;
        return (
          '<rect x="' + x.toFixed(2) + '" y="' + (baseY - heightValue).toFixed(2) + '" width="' + barWidth.toFixed(2) + '" height="' + heightValue.toFixed(2) + '" rx="6" fill="' + SERIES_COLORS[seriesIndex % SERIES_COLORS.length] + '">' +
          '<title>' + escapeHtml(series.label + " | " + formatXAxisTooltip(trendBundle.xFieldId, point.xValue) + " | " + formatTrendMetric(metric, value)) + "</title></rect>"
        );
      }).join("");
    }).join("");

    const empty = !visibleSeries.length
      ? '<text x="' + width / 2 + '" y="' + height / 2 + '" text-anchor="middle" font-size="16" fill="#5d6570">当前没有可见序列，请点击图例恢复显示</text>'
      : (!barCount
        ? '<text x="' + width / 2 + '" y="' + height / 2 + '" text-anchor="middle" font-size="16" fill="#5d6570">当前筛选条件下没有可绘制的柱状数据</text>'
        : "");

    return (
      '<svg class="chart-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="柱状图">' +
      gridLines +
      '<line x1="' + padding.left + '" y1="' + (height - padding.bottom) + '" x2="' + (width - padding.right) + '" y2="' + (height - padding.bottom) + '" stroke="rgba(23,33,43,0.16)"></line>' +
      '<line x1="' + padding.left + '" y1="' + padding.top + '" x2="' + padding.left + '" y2="' + (height - padding.bottom) + '" stroke="rgba(23,33,43,0.16)"></line>' +
      xLabels +
      bars +
      empty +
      "</svg>" +
      '<div class="chart-meta"><span>图表：柱状图 / X 轴：' + escapeHtml(getTrendXAxisLabel(schema, trendBundle.xFieldId)) + ' / Y 轴：' + escapeHtml(metric ? getMetricDisplayLabel(metric) : "") + '</span><span>柱状图沿用当前序列显示状态，并在低跨度场景下启用兜底刻度。</span></div>'
    );
  }

  function renderTrendPieSvg(schema, trendBundle, visibleSeriesKeys, metric) {
    const width = 960;
    const height = 360;
    const cx = 250;
    const cy = 180;
    const radius = 116;
    const slices = visibleSeriesKeys.length <= 1
      ? buildPieSlicesByXAxis(trendBundle, visibleSeriesKeys)
      : buildPieSlicesBySeries(trendBundle, visibleSeriesKeys);
    const total = slices.reduce(function (sum, slice) {
      return sum + slice.value;
    }, 0);

    if (!total) {
      return (
        '<svg class="chart-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="饼图">' +
        '<text x="' + width / 2 + '" y="' + height / 2 + '" text-anchor="middle" font-size="16" fill="#5d6570">当前筛选条件下没有可绘制的饼图数据</text>' +
        "</svg>" +
        '<div class="chart-meta"><span>图表：饼图 / 指标：' + escapeHtml(metric ? getMetricDisplayLabel(metric) : "") + '</span><span>单序列时按当前 X 轴分类，多序列时按组别汇总。</span></div>'
      );
    }

    let startAngle = 0;
    const arcs = slices.map(function (slice, index) {
      const ratio = slice.value / total;
      const endAngle = startAngle + ratio * Math.PI * 2;
      const path = describePieArc(cx, cy, radius, startAngle, endAngle);
      const arc = '<path d="' + path + '" fill="' + SERIES_COLORS[index % SERIES_COLORS.length] + '" stroke="#f7f3e7" stroke-width="2"><title>' + escapeHtml(slice.label + " | " + formatTrendMetric(metric, slice.value) + " | " + numberFormatter.format(ratio * 100) + "%") + "</title></path>";
      startAngle = endAngle;
      return arc;
    }).join("");

    return (
      '<svg class="chart-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="饼图">' +
      arcs +
      '<circle cx="' + cx + '" cy="' + cy + '" r="54" fill="#fffaf0"></circle>' +
      '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" font-size="13" fill="#5d6570">总量</text>' +
      '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" font-size="20" font-weight="700" fill="#213547">' + escapeHtml(formatTrendMetric(metric, total)) + "</text>" +
      '<foreignObject x="500" y="40" width="370" height="270"><div xmlns="http://www.w3.org/1999/xhtml" class="pie-sidecar">' +
      slices.map(function (slice, index) {
        const ratio = total ? slice.value / total * 100 : 0;
        return '<div class="pie-legend-item"><span class="dot" style="background:' + SERIES_COLORS[index % SERIES_COLORS.length] + '"></span><strong>' + escapeHtml(slice.label) + '</strong><span>' + escapeHtml(formatTrendMetric(metric, slice.value)) + '</span><small>' + escapeHtml(numberFormatter.format(ratio) + '%') + '</small></div>';
      }).join("") +
      '</div></foreignObject>' +
      "</svg>" +
      '<div class="chart-meta"><span>图表：饼图 / 指标：' + escapeHtml(metric ? getMetricDisplayLabel(metric) : "") + '</span><span>单序列时按当前 X 轴分类，多序列时按可见组别汇总占比。</span></div>'
    );
  }

  function renderTrendYAxisGrid(yTicks, metric, startX, endX) {
    return yTicks.map(function (tick) {
      return (
        '<line x1="' + startX + '" y1="' + tick.y.toFixed(2) + '" x2="' + endX + '" y2="' + tick.y.toFixed(2) + '" stroke="rgba(15,23,42,0.08)" stroke-dasharray="4 4"></line>' +
        '<text x="' + (startX - 12) + '" y="' + (tick.y + 4).toFixed(2) + '" text-anchor="end" font-size="12" fill="#5d6570">' +
        escapeHtml(formatAxisMetricValue(metric, tick.value)) +
        "</text>"
      );
    }).join("");
  }

  function renderTrendXAxisLabels(data, xFieldId, height, padding, stepWidth, offset) {
    return data.map(function (point, index) {
      const x = padding.left + offset + stepWidth * index;
      if (data.length > 6 && index !== 0 && index !== data.length - 1 && index % Math.ceil(data.length / 4) !== 0) return "";
      return '<text x="' + x.toFixed(2) + '" y="' + (height - 12) + '" text-anchor="middle" font-size="12" fill="#5d6570">' + escapeHtml(formatXAxisTick(xFieldId, point.xValue)) + "</text>";
    }).join("");
  }

  function buildPieSlicesBySeries(trendBundle, visibleSeriesKeys) {
    return trendBundle.seriesMeta
      .filter(function (series) {
        return visibleSeriesKeys.includes(series.key);
      })
      .map(function (series) {
        return {
          label: series.label,
          value: trendBundle.data.reduce(function (sum, point) {
            const value = point[getSeriesMetricKey(series.key, state.trendMetric)];
            return sum + (Number.isFinite(value) ? value : 0);
          }, 0)
        };
      })
      .filter(function (slice) {
        return slice.value > 0;
      });
  }

  function buildPieSlicesByXAxis(trendBundle, visibleSeriesKeys) {
    const seriesKey = visibleSeriesKeys[0];
    if (!seriesKey) return [];
    return trendBundle.data
      .map(function (point) {
        const value = point[getSeriesMetricKey(seriesKey, state.trendMetric)];
        return {
          label: formatXAxisTick(trendBundle.xFieldId, point.xValue),
          value: Number.isFinite(value) ? value : 0
        };
      })
      .filter(function (slice) {
        return slice.value > 0;
      });
  }

  function describePieArc(cx, cy, radius, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
    return [
      "M", cx, cy,
      "L", start.x.toFixed(2), start.y.toFixed(2),
      "A", radius, radius, 0, largeArcFlag, 0, end.x.toFixed(2), end.y.toFixed(2),
      "Z"
    ].join(" ");
  }

  function polarToCartesian(cx, cy, radius, angleInRadians) {
    return {
      x: cx + radius * Math.cos(angleInRadians - Math.PI / 2),
      y: cy + radius * Math.sin(angleInRadians - Math.PI / 2)
    };
  }

  function renderFormulaEditor(schema) {
    const formulaConfigs = getOrderedFormulaConfigs(schema);
    const presetConfigs = formulaConfigs.filter(function (config) { return Boolean(config.presetId); });
    const activeConfigs = formulaConfigs.filter(function (config) { return config.selected; });
    const ratioFormula = "((本实验组该统计量 / 对照组该统计量) - 1) * 100";

    return (
      '<div class="filter-block formula-workbench"><div class="filter-head"><strong>统计量与公式</strong><span class="muted">先选择要展示的统计量，再为它配置公式。缺少变量时会在卡片底部直接提醒。</span></div>' +
      '<div class="formula-toolbar">' +
      '<div class="formula-preset-row">' +
      presetConfigs.map(function (config) {
        return renderFormulaPresetPill(config);
      }).join("") +
      "</div>" +
      '<div class="button-row"><button type="button" class="button-ghost" id="addCustomMetricBtn">新增自定义统计量</button></div>' +
      "</div>" +
      '<div class="formula-reference-box">' +
      '<div class="field-note"><strong>已识别底层指标：</strong> ' + escapeHtml(schema.baseMetrics.map(function (metric) { return metric.label; }).join(" / ")) + "</div>" +
      '<div class="field-note"><strong>已识别维度：</strong> ' + escapeHtml(schema.dimensionFields.length ? schema.dimensionFields.map(function (field) { return field.label; }).join(" / ") : "暂无") + "</div>" +
      "</div>" +
      (activeConfigs.length
        ? '<div class="formula-grid">' + activeConfigs.map(function (config) {
            return renderFormulaCard(config, schema);
          }).join("") + "</div>"
        : '<div class="empty inline-empty"><div><strong>还没有启用统计量</strong><p class="muted">可以先点上面的预置指标，也可以新增一个自定义统计量。</p></div></div>') +
      '<div class="formula-reference-box formula-helper-box">' +
      '<div class="field-note"><strong>环比算法（实验组 vs 对照组）：</strong>' + escapeHtml(ratioFormula) + "</div>" +
      '<div class="field-note"><strong>展示格式：</strong>结果转成百分比，并保留小数点后两位。</div>' +
      '<div class="field-note"><strong>适用场景：</strong>用于看实验组相对对照组的变化幅度，和表格里的提升率口径一致。</div>' +
      "</div>" +
      '<div class="button-row" style="margin-top:10px;"><button type="button" class="button-ghost" id="applyFormulaBtn">应用统计量配置</button></div></div>'
    );
  }

  if (typeof window !== "undefined") {
    window.ABDashboardDebug = {
      normalizeRows: normalizeRows,
      inferSchema: inferSchema,
      analyzeColumns: analyzeColumns,
      parseSheetToRows: parseSheetToRows,
      pickBestSheet: pickBestSheet,
      buildTrendData: buildTrendData,
      buildDimensionSections: buildDimensionSections,
      getTrendXAxisOptions: getTrendXAxisOptions,
      normalizeDate: normalizeDate,
      buildFormulaMetricConfigs: buildFormulaMetricConfigs,
      filterRowsByDimensionFilters: filterRowsByDimensionFilters,
      renderTrendSvg: renderTrendSvg,
      buildTrendYAxisTicks: buildTrendYAxisTicks,
      computeYAxisDomain: computeYAxisDomain,
      computeScaledTrendDomain: computeScaledTrendDomain,
      sliderValueToTrendZoomScale: sliderValueToTrendZoomScale,
      trendZoomScaleToSliderValue: trendZoomScaleToSliderValue,
      isExcludedAggregateDimensionValue: isExcludedAggregateDimensionValue,
      state: state
    };
  }

  render();
  void loadSampleData();
})();
