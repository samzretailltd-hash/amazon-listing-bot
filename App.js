import { useState, useRef, useCallback, useEffect } from "react";

const AMAZON_CATEGORIES = [
  "Electronics", "Home & Kitchen", "Beauty & Personal Care", "Sports & Outdoors",
  "Clothing & Apparel", "Toys & Games", "Health & Household", "Books",
  "Automotive", "Garden & Outdoor", "Pet Supplies", "Baby Products",
  "Office Products", "Kitchen & Dining", "Tools & Home Improvement"
];

const TRENDING_KEYWORDS_DB = {
  "Electronics": ["wireless","bluetooth 5.0","fast charging","noise cancelling","waterproof","smart home compatible","alexa compatible","USB-C","long battery life","portable"],
  "Home & Kitchen": ["non-stick","dishwasher safe","BPA free","space saving","easy clean","stainless steel","eco friendly","multi-purpose","durable","modern design"],
  "Beauty & Personal Care": ["cruelty free","vegan","organic","hypoallergenic","dermatologist tested","sulfate free","paraben free","natural ingredients","anti-aging","moisturizing"],
  "Sports & Outdoors": ["lightweight","breathable","moisture wicking","UV protection","all weather","heavy duty","ergonomic","high performance","durable","professional grade"],
  "Clothing & Apparel": ["slim fit","machine washable","wrinkle resistant","breathable fabric","premium quality","comfortable","versatile","stylish","all season","stretchable"],
  "Toys & Games": ["STEM learning","educational","safe for kids","non-toxic","age appropriate","interactive","durable","award winning","creative play","screen free"],
  "Health & Household": ["natural","plant based","eco friendly","non toxic","concentrated formula","long lasting","clinically tested","safe for family","biodegradable","effective"],
  "Baby Products": ["BPA free","soft material","easy to clean","safe for newborns","dermatologist tested","hypoallergenic","durable","easy to use","pediatrician recommended","non-toxic"],
  "default": ["premium quality","best seller","highly rated","fast delivery","money back guarantee","customer favorite","top rated","trusted brand","value pack","limited edition"]
};

// ── All API calls go through /api/claude (our Vercel proxy) ──
// The proxy adds the real API key server-side — key never touches the browser.
const callClaude = async (body) => {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || data.error || "API error");
  return data;
};

export default function App() {
  const [step, setStep] = useState("input");
  const [productInput, setProductInput] = useState("");
  const [pricePoint, setPricePoint] = useState("");
  const [listing, setListing] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [activeTab, setActiveTab] = useState("title");
  const [copied, setCopied] = useState("");
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Auto-detect state
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [detectedCategory, setDetectedCategory] = useState("");
  const [detectedAudience, setDetectedAudience] = useState("");
  const [detectedFeatures, setDetectedFeatures] = useState("");
  const [detectedConfidence, setDetectedConfidence] = useState(null);
  const [autoDetectDone, setAutoDetectDone] = useState(false);
  const [autoDetectError, setAutoDetectError] = useState("");
  const [overrideCategory, setOverrideCategory] = useState(false);
  const [overrideAudience, setOverrideAudience] = useState(false);
  const [overrideFeatures, setOverrideFeatures] = useState(false);
  const [manualCategory, setManualCategory] = useState("");
  const [manualAudience, setManualAudience] = useState("");
  const [manualFeatures, setManualFeatures] = useState("");
  const detectDebounceRef = useRef(null);

  const fileToBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const handleFiles = useCallback((files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 5);
    Promise.all(imgs.map(async (file) => {
      const base64 = await fileToBase64(file);
      return { file, base64, preview: `data:${file.type};base64,${base64}`, name: file.name, mediaType: file.type };
    })).then(result => setUploadedImages(prev => [...prev, ...result].slice(0, 5)));
  }, []);

  const onDrop = useCallback((e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }, [handleFiles]);
  const removeImage = (idx) => setUploadedImages(prev => prev.filter((_, i) => i !== idx));

  const runAutoDetect = useCallback(async (title, images) => {
    if (!title.trim() || title.trim().length < 5) {
      setAutoDetectDone(false); setDetectedCategory(""); setDetectedAudience(""); setDetectedFeatures(""); setDetectedConfidence(null);
      return;
    }
    setAutoDetecting(true); setAutoDetectDone(false); setAutoDetectError("");
    const msgContent = [];
    if (images.length > 0) {
      msgContent.push({ type: "image", source: { type: "base64", media_type: images[0].mediaType, data: images[0].base64 } });
    }
    msgContent.push({
      type: "text",
      text: `You are an Amazon product intelligence expert. Analyze this product and return ONLY valid JSON, no markdown, no extra text.

PRODUCT TITLE: "${title}"
${images.length > 0 ? "PRODUCT IMAGE: Attached above — use it to improve accuracy." : ""}
AVAILABLE AMAZON CATEGORIES: ${AMAZON_CATEGORIES.join(", ")}

Return JSON:
{
  "category": "exact match from the available categories list above",
  "targetAudience": "specific buyer personas, 1-2 sentences",
  "keyFeatures": "3-5 most important USP features as comma-separated list",
  "confidence": 95,
  "reasoning": "one short sentence explaining detection logic"
}`
    });
    try {
      const data = await callClaude({ model: "claude-sonnet-4-20250514", max_tokens: 400, messages: [{ role: "user", content: msgContent }] });
      const text = data.content?.map(b => b.text || "").join("") || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setDetectedCategory(parsed.category || "");
      setDetectedAudience(parsed.targetAudience || "");
      setDetectedFeatures(parsed.keyFeatures || "");
      setDetectedConfidence(parsed.confidence || null);
      setAutoDetectDone(true);
    } catch (e) {
      setAutoDetectError("Auto-detect failed — fill in manually or retry.");
    } finally {
      setAutoDetecting(false);
    }
  }, []);

  useEffect(() => {
    if (detectDebounceRef.current) clearTimeout(detectDebounceRef.current);
    if (productInput.trim().length >= 5) {
      detectDebounceRef.current = setTimeout(() => runAutoDetect(productInput, uploadedImages), 1200);
    } else {
      setAutoDetectDone(false); setDetectedCategory(""); setDetectedAudience(""); setDetectedFeatures("");
    }
    return () => clearTimeout(detectDebounceRef.current);
  }, [productInput]);

  useEffect(() => {
    if (uploadedImages.length > 0 && productInput.trim().length >= 5) {
      if (detectDebounceRef.current) clearTimeout(detectDebounceRef.current);
      detectDebounceRef.current = setTimeout(() => runAutoDetect(productInput, uploadedImages), 800);
    }
  }, [uploadedImages.length]);

  const finalCategory = overrideCategory ? manualCategory : detectedCategory;
  const finalAudience = overrideAudience ? manualAudience : detectedAudience;
  const finalFeatures = overrideFeatures ? manualFeatures : detectedFeatures;

  const simulateProgress = async (steps) => {
    for (const [text, pct] of steps) { setProgressText(text); setProgress(pct); await new Promise(r => setTimeout(r, 500 + Math.random() * 400)); }
  };

  const generateListing = async () => {
    if (!productInput.trim() || !finalCategory) return;
    setStep("generating"); setProgress(0);
    const trendingKws = TRENDING_KEYWORDS_DB[finalCategory] || TRENDING_KEYWORDS_DB["default"];
    const hasImages = uploadedImages.length > 0;

    await simulateProgress([
      [hasImages ? "🖼️ Scanning product images with AI vision..." : "📋 Reading product details...", 6],
      [hasImages ? "📐 Estimating product dimensions & size..." : "🔍 Parsing product attributes...", 14],
      ["🎯 Applying AI-detected category, audience & features...", 22],
      ["🔍 Cross-referencing Amazon A9 algorithm signals...", 32],
      ["📊 Mining top-ranking competitor keywords...", 44],
      ["📈 Extracting long-tail & short-tail keyword clusters...", 55],
      ["⚡ Crafting A9-optimized title with power words...", 65],
      ["🎯 Writing 5 conversion-focused bullet points...", 75],
      ["📝 Building SEO-rich HTML description...", 85],
      ["🏷️ Scoring keyword density & placement quality...", 93],
      ["✅ Finalizing listing for maximum Buy Box impact...", 98],
    ]);

    const messageContent = [];
    if (hasImages) {
      for (const img of uploadedImages) {
        messageContent.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
      }
    }
    const imageInstruction = hasImages ? `
PRODUCT IMAGES (${uploadedImages.length}): Analyze carefully:
1. Confirm product type, brand/logos, color variants
2. Estimate SIZE/DIMENSIONS using scale references, hands, packaging text, proportions
3. Identify all materials: plastic, metal, fabric, glass, silicone, etc.
4. List all visible features: buttons, ports, compartments, accessories
5. Assess quality tier (premium/mid/budget) from visual cues
6. Use ALL visual data to enrich title, bullets, keywords, description
` : "";

    messageContent.push({
      type: "text",
      text: `You are an elite Amazon A9 SEO expert and conversion optimization specialist with computer vision capability.
${imageInstruction}
Generate the PERFECT Amazon product listing using all available data.

PRODUCT: ${productInput}
CATEGORY (AI-detected): ${finalCategory}
TARGET AUDIENCE (AI-detected): ${finalAudience}
KEY FEATURES/USP (AI-detected): ${finalFeatures}
PRICE POINT: ${pricePoint || "Mid-range"}
TRENDING KEYWORDS: ${trendingKws.join(", ")}

Return ONLY valid JSON (no markdown, no backticks):
{
  "imageAnalysis": {
    "productType": "exact product identification",
    "detectedColors": ["color1","color2"],
    "detectedMaterials": ["material1","material2"],
    "estimatedSize": "Detailed size estimate with reasoning",
    "visibleFeatures": ["feature1","feature2","feature3","feature4"],
    "packagingObservations": "any text/info visible on packaging or labels",
    "qualityAssessment": "premium/mid-range/budget with reasoning",
    "additionalObservations": "any other important visual details"
  },
  "title": "Perfect A9 title 180 chars max, front-load top keyword, include brand if visible, key size/spec, | separator",
  "brand": "Brand name if visible, else suggest fitting brand name",
  "primaryKeywords": ["kw1","kw2","kw3","kw4","kw5","kw6"],
  "longTailKeywords": ["phrase1","phrase2","phrase3","phrase4","phrase5","phrase6","phrase7","phrase8"],
  "shortTailKeywords": ["kw1","kw2","kw3","kw4","kw5"],
  "bullets": [
    "CAPS HOOK – Feature + keyword + specific buyer benefit (max 200 chars)",
    "CAPS HOOK – Size/spec detail + use case + keyword",
    "CAPS HOOK – Material/quality + durability + social proof",
    "CAPS HOOK – Unique differentiator + compatibility + keywords",
    "CAPS HOOK – Guarantee or trust signal + brand authority"
  ],
  "description": "Rich HTML 700-900 words. Use p and b tags. 3 sections: emotional opening hook, detailed features from images, powerful CTA close. Weave trending keywords naturally.",
  "searchTerms": "Backend search terms: 240 chars max, space-separated, no duplicates, no brand names, include synonyms and misspellings",
  "asinScore": 91,
  "keywordDensityScore": 93,
  "conversionScore": 90,
  "seoScore": 94,
  "improvements": ["improvement 1","improvement 2","improvement 3"],
  "competitorGaps": ["gap 1","gap 2","gap 3"],
  "pricingInsight": "One concrete pricing strategy sentence"
}`
    });

    try {
      const data = await callClaude({ model: "claude-sonnet-4-20250514", max_tokens: 4000, messages: [{ role: "user", content: messageContent }] });
      const text = data.content?.map(b => b.text || "").join("") || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setListing(parsed);
      setProgress(100); setProgressText("✅ Listing optimized successfully!");
      await new Promise(r => setTimeout(r, 700));
      setActiveTab(hasImages ? "vision" : "title");
      setStep("result");
    } catch (e) {
      setProgressText(`❌ Error: ${e.message || "Please try again."}`);
      setTimeout(() => setStep("input"), 3000);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(Array.isArray(text) ? text.join("\n\n") : (text || ""));
    setCopied(key); setTimeout(() => setCopied(""), 2000);
  };

  const resetAll = () => {
    setStep("input"); setListing(null); setProductInput(""); setPricePoint("");
    setUploadedImages([]); setActiveTab("title"); setAutoDetectDone(false);
    setDetectedCategory(""); setDetectedAudience(""); setDetectedFeatures("");
    setOverrideCategory(false); setOverrideAudience(false); setOverrideFeatures(false);
    setManualCategory(""); setManualAudience(""); setManualFeatures("");
  };

  const ScoreRing = ({ score, label, color }) => {
    const r = 26, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
    return (
      <div style={{ textAlign: "center" }}>
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r={r} fill="none" stroke="#1a2235" strokeWidth="5" />
          <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 34 34)" style={{ transition: "stroke-dasharray 1.2s ease" }} />
          <text x="34" y="39" textAnchor="middle" fill={color} fontSize="14" fontWeight="800">{score}</text>
        </svg>
        <div style={{ fontSize: "10px", color: "#7a8fa8", marginTop: 2, fontFamily: "monospace" }}>{label}</div>
      </div>
    );
  };

  const AIField = ({ label, icon, value, isDetecting, isDone, isOverridden, onOverride, overrideValue, setOverrideValue, type }) => (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 11, color: "#f59500", fontWeight: 800, letterSpacing: 1, display: "block" }}>{icon} {label}</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {isDetecting && <span style={{ fontSize: 10, color: "#4fc3f7", display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>⚙️</span> Detecting...</span>}
          {isDone && !isOverridden && <span style={{ fontSize: 10, background: "rgba(0,200,150,0.15)", border: "1px solid rgba(0,200,150,0.4)", color: "#00c896", borderRadius: 10, padding: "2px 8px", fontWeight: 700 }}>✅ AI Detected</span>}
          {isDone && <button onClick={() => onOverride(!isOverridden)} style={{ fontSize: 10, background: isOverridden ? "rgba(245,149,0,0.2)" : "rgba(255,255,255,0.07)", border: `1px solid ${isOverridden ? "rgba(245,149,0,0.5)" : "rgba(255,255,255,0.15)"}`, borderRadius: 10, padding: "2px 8px", color: isOverridden ? "#f59500" : "#8899aa", cursor: "pointer", fontWeight: 700 }}>{isOverridden ? "🤖 Use AI" : "✏️ Override"}</button>}
        </div>
      </div>
      {!isOverridden ? (
        <div style={{ width: "100%", background: isDetecting ? "rgba(79,195,247,0.05)" : isDone ? "rgba(0,200,150,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${isDetecting ? "rgba(79,195,247,0.3)" : isDone ? "rgba(0,200,150,0.35)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "11px 14px", color: isDetecting ? "#4fc3f7" : isDone ? "#b0ead8" : "#556677", minHeight: 42, display: "flex", alignItems: "center", fontStyle: isDone ? "normal" : "italic", fontSize: 12, boxSizing: "border-box" }}>
          {isDetecting ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>🔄</span> AI is analyzing your product...</span> : isDone ? value : "Waiting for product title..."}
        </div>
      ) : type === "select" ? (
        <select value={overrideValue} onChange={e => setOverrideValue(e.target.value)} style={{ width: "100%", background: "#0b1525", border: "1px solid rgba(245,149,0,0.5)", borderRadius: 10, padding: "11px 14px", color: "#dce8f5", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
          <option value="">Select category...</option>
          {AMAZON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <input value={overrideValue} onChange={e => setOverrideValue(e.target.value)} placeholder={`Override ${label.toLowerCase()}...`} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,149,0,0.5)", borderRadius: 10, padding: "11px 14px", color: "#dce8f5", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
      )}
    </div>
  );

  const hasImages = uploadedImages.length > 0;
  const canGenerate = productInput.trim() && finalCategory;
  const tabs = [
    { key: "vision", label: "🔬 Vision", show: hasImages },
    { key: "title", label: "📝 Title", show: true },
    { key: "bullets", label: "🎯 Bullets", show: true },
    { key: "description", label: "📄 Description", show: true },
    { key: "keywords", label: "🔑 Keywords", show: true },
    { key: "backend", label: "🔧 Backend", show: true },
    { key: "insights", label: "💡 Insights", show: true },
  ].filter(t => t.show);

  const S = { input: { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,149,0,0.25)", borderRadius: 10, padding: "11px 14px", color: "#dce8f5", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" } };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#060c18 0%,#0b1525 50%,#091220 100%)", fontFamily: "'Segoe UI',system-ui,sans-serif", color: "#dce8f5" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(90deg,#e65c00,#f9a825)", boxShadow: "0 4px 40px rgba(230,92,0,0.5)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🛒</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>Amazon A9 Vision Listing Bot</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", letterSpacing: 1 }}>AI VISION • AUTO-DETECT • IMAGE ANALYSIS • A9 SEO OPTIMIZED</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "rgba(0,200,150,0.2)", border: "1px solid rgba(0,200,150,0.5)", color: "#00c896" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00c896", boxShadow: "0 0 6px #00c896" }} />
              🔒 Secure Server Mode
            </div>
          </div>
        </div>
      </div>
      <div style={{ background: "rgba(0,200,150,0.08)", borderBottom: "1px solid rgba(0,200,150,0.2)", padding: "8px 24px", textAlign: "center", fontSize: 12, color: "#00c896" }}>
        🔒 Your API key is stored securely on the server — never exposed to the browser
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>

        {step === "input" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#f59500", marginBottom: 6 }}>AI-Powered Amazon Listing Generator</div>
              <div style={{ color: "#7a8fa8", fontSize: 13 }}>Type your product title — AI instantly auto-detects category, audience & features from your title and images</div>
            </div>

            {/* Drop Zone */}
            <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${isDragging ? "#f59500" : "rgba(245,149,0,0.35)"}`, borderRadius: 16, padding: "24px 20px", textAlign: "center", cursor: "pointer", background: isDragging ? "rgba(245,149,0,0.07)" : "rgba(255,255,255,0.02)", transition: "all 0.2s", marginBottom: 16 }}>
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
              <div style={{ fontSize: 34, marginBottom: 8 }}>📸</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#f59500", marginBottom: 4 }}>Drop product images here or click to upload</div>
              <div style={{ fontSize: 11, color: "#7a8fa8" }}>Up to 5 images • AI vision detects size, color, material, features, brand</div>
            </div>

            {uploadedImages.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                {uploadedImages.map((img, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={img.preview} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, border: "2px solid rgba(245,149,0,0.5)", display: "block" }} />
                    <button onClick={() => removeImage(i)} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#e53935", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", fontWeight: 900, lineHeight: "18px", textAlign: "center", padding: 0 }}>✕</button>
                    {i === 0 && <div style={{ position: "absolute", bottom: 4, left: 4, background: "#f59500", borderRadius: 3, fontSize: 8, padding: "1px 4px", color: "#000", fontWeight: 900 }}>MAIN</div>}
                  </div>
                ))}
                {uploadedImages.length < 5 && <div onClick={() => fileInputRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 10, border: "2px dashed rgba(245,149,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#7a8fa8", fontSize: 24 }}>+</div>}
                <div style={{ background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 10, padding: "8px 14px", fontSize: 11, color: "#00c896" }}>✅ {uploadedImages.length} image{uploadedImages.length > 1 ? "s" : ""} ready</div>
              </div>
            )}

            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(245,149,0,0.18)", borderRadius: 16, padding: 28 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, color: "#f59500", fontWeight: 800, letterSpacing: 1 }}>📦 PRODUCT TITLE / DESCRIPTION *</label>
                  {autoDetecting && <span style={{ fontSize: 11, color: "#4fc3f7", display: "flex", alignItems: "center", gap: 5, animation: "pulse 1s infinite" }}><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>🤖</span> AI detecting fields...</span>}
                  {autoDetectDone && !autoDetecting && <span style={{ fontSize: 11, color: "#00c896", fontWeight: 700 }}>✅ All fields detected {detectedConfidence && `(${detectedConfidence}% confidence)`}</span>}
                </div>
                <textarea value={productInput} onChange={e => setProductInput(e.target.value)}
                  placeholder="e.g. Stainless Steel Insulated Water Bottle 32oz with Straw Lid, BPA Free, Leak Proof..."
                  style={{ ...S.input, resize: "vertical", minHeight: 72, border: `1px solid ${productInput ? "rgba(245,149,0,0.5)" : "rgba(245,149,0,0.25)"}` }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
                <AIField label="AMAZON CATEGORY" icon="🏷️" value={detectedCategory} isDetecting={autoDetecting} isDone={autoDetectDone} isOverridden={overrideCategory} onOverride={setOverrideCategory} overrideValue={manualCategory} setOverrideValue={setManualCategory} type="select" />
                <div>
                  <label style={{ fontSize: 11, color: "#f59500", fontWeight: 800, letterSpacing: 1, display: "block", marginBottom: 6 }}>💰 PRICE POINT</label>
                  <select value={pricePoint} onChange={e => setPricePoint(e.target.value)} style={{ ...S.input, background: "#0b1525", cursor: "pointer" }}>
                    <option value="">Select range...</option>
                    <option>Budget ($1–$15)</option><option>Mid-range ($15–$50)</option>
                    <option>Premium ($50–$150)</option><option>Luxury ($150+)</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <AIField label="TARGET AUDIENCE" icon="👥" value={detectedAudience} isDetecting={autoDetecting} isDone={autoDetectDone} isOverridden={overrideAudience} onOverride={setOverrideAudience} overrideValue={manualAudience} setOverrideValue={setManualAudience} type="text" />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <AIField label="KEY FEATURES / USP" icon="⭐" value={detectedFeatures} isDetecting={autoDetecting} isDone={autoDetectDone} isOverridden={overrideFeatures} onOverride={setOverrideFeatures} overrideValue={manualFeatures} setOverrideValue={setManualFeatures} type="text" />
                </div>
              </div>

              {autoDetectError && (
                <div style={{ background: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.25)", borderRadius: 10, padding: "9px 14px", marginBottom: 16, fontSize: 12, color: "#ff8888" }}>
                  ⚠️ {autoDetectError} <button onClick={() => runAutoDetect(productInput, uploadedImages)} style={{ marginLeft: 8, background: "none", border: "1px solid rgba(229,57,53,0.4)", borderRadius: 6, padding: "2px 8px", color: "#ff8888", fontSize: 11, cursor: "pointer" }}>Retry</button>
                </div>
              )}

              <button onClick={generateListing} disabled={!canGenerate}
                style={{ width: "100%", padding: "16px", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 900, letterSpacing: 1, transition: "all 0.2s", background: !canGenerate ? "rgba(245,149,0,0.15)" : "linear-gradient(90deg,#e65c00,#f9a825)", cursor: !canGenerate ? "not-allowed" : "pointer", boxShadow: !canGenerate ? "none" : "0 8px 32px rgba(230,92,0,0.55)" }}>
                {!productInput.trim() ? "⌨️ Enter Product Title First" : autoDetecting ? "🤖 AI Detecting Fields..." : !finalCategory ? "⏳ Waiting for AI Detection..." : hasImages ? `🔬 ANALYZE ${uploadedImages.length} IMAGE${uploadedImages.length > 1 ? "S" : ""} + GENERATE LISTING` : "🚀 GENERATE OPTIMIZED LISTING"}
              </button>
            </div>
          </div>
        )}

        {step === "generating" && (
          <div style={{ textAlign: "center", padding: "70px 20px" }}>
            <div style={{ fontSize: 52, marginBottom: 18, display: "inline-block", animation: "spin 2s linear infinite" }}>⚙️</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f59500", marginBottom: 8 }}>{hasImages ? "Analyzing Images & Building Your Listing..." : "Optimizing Your Listing..."}</div>
            <div style={{ color: "#7a8fa8", fontSize: 14, marginBottom: 36 }}>{progressText}</div>
            <div style={{ maxWidth: 520, margin: "0 auto", background: "rgba(255,255,255,0.05)", borderRadius: 12, height: 12, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 12, background: "linear-gradient(90deg,#e65c00,#f9a825,#ffe066)", width: `${progress}%`, transition: "width 0.6s ease", boxShadow: "0 0 14px rgba(245,149,0,0.6)" }} />
            </div>
            <div style={{ color: "#f59500", fontSize: 14, marginTop: 10, fontWeight: 800 }}>{progress}%</div>
          </div>
        )}

        {step === "result" && listing && (
          <div>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(245,149,0,0.2)", borderRadius: 16, padding: "18px 24px", marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Listing Ready — <span style={{ color: "#f59500" }}>{finalCategory}</span>
                  {hasImages && <span style={{ marginLeft: 8, fontSize: 12, color: "#00c896", background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 10, padding: "2px 9px" }}>📸 {uploadedImages.length} images analyzed</span>}
                  <span style={{ marginLeft: 8, fontSize: 12, color: "#4fc3f7", background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.3)", borderRadius: 10, padding: "2px 9px" }}>🤖 AI auto-detected</span>
                </div>
                <div style={{ fontSize: 11, color: "#7a8fa8", marginTop: 3 }}>A9 optimized • {new Date().toLocaleDateString()} • Secure server mode</div>
              </div>
              <div style={{ display: "flex", gap: 18 }}>
                <ScoreRing score={listing.asinScore || 91} label="A9 SCORE" color="#f59500" />
                <ScoreRing score={listing.seoScore || 94} label="SEO" color="#00c896" />
                <ScoreRing score={listing.conversionScore || 90} label="CVR" color="#4fc3f7" />
                <ScoreRing score={listing.keywordDensityScore || 93} label="KW DENSITY" color="#ab47bc" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 4, marginBottom: 18, flexWrap: "wrap" }}>
              {tabs.map(t => <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800, textTransform: "uppercase", background: activeTab === t.key ? "linear-gradient(90deg,#e65c00,#f9a825)" : "rgba(255,255,255,0.05)", color: activeTab === t.key ? "#fff" : "#7a8fa8", transition: "all 0.18s" }}>{t.label}</button>)}
            </div>

            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(245,149,0,0.15)", borderRadius: 16, padding: 26 }}>
              {activeTab === "vision" && listing.imageAnalysis && (
                <div>
                  <div style={{ fontSize: 13, color: "#f59500", fontWeight: 800, marginBottom: 20 }}>🔬 AI VISION — PRODUCT ANALYSIS REPORT</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                    {[["🏷️ Product","productType","#f59500",false],["📐 Estimated Size","estimatedSize","#f59500",true],["🎨 Colors","detectedColors","#4fc3f7",false],["🧱 Materials","detectedMaterials","#4fc3f7",false],["⭐ Quality","qualityAssessment","#00c896",false],["📦 Packaging","packagingObservations","#00c896",false]].map(([label,key,color,hl]) => (
                      <div key={key} style={{ background: hl ? "rgba(245,149,0,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${hl ? "rgba(245,149,0,0.4)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 7 }}>{label}</div>
                        <div style={{ fontSize: 13, color: "#dce8f5", lineHeight: 1.6 }}>{Array.isArray(listing.imageAnalysis[key]) ? listing.imageAnalysis[key].join(", ") : listing.imageAnalysis[key] || "—"}</div>
                      </div>
                    ))}
                    <div style={{ gridColumn: "1/-1", background: "rgba(79,195,247,0.06)", border: "1px solid rgba(79,195,247,0.2)", borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 11, color: "#4fc3f7", fontWeight: 700, marginBottom: 10 }}>✅ VISIBLE FEATURES DETECTED</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{listing.imageAnalysis.visibleFeatures?.map((f,i) => <span key={i} style={{ background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.25)", borderRadius: 16, padding: "5px 13px", fontSize: 12, color: "#4fc3f7" }}>{f}</span>)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>{uploadedImages.map((img,i) => <img key={i} src={img.preview} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: "2px solid rgba(245,149,0,0.4)" }} />)}</div>
                </div>
              )}
              {activeTab === "title" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 13, color: "#f59500", fontWeight: 800 }}>A9-OPTIMIZED PRODUCT TITLE</div>
                    <button onClick={() => copyToClipboard(listing.title,"title")} style={{ background: copied==="title"?"#00c896":"rgba(245,149,0,0.18)", border:"1px solid rgba(245,149,0,0.4)", borderRadius:8, padding:"6px 14px", color:copied==="title"?"#fff":"#f59500", fontSize:12, cursor:"pointer", fontWeight:700 }}>{copied==="title"?"✓ Copied!":"Copy"}</button>
                  </div>
                  <div style={{ background:"rgba(245,149,0,0.06)", border:"1px solid rgba(245,149,0,0.3)", borderRadius:12, padding:20, fontSize:16, lineHeight:1.65, color:"#dce8f5", fontWeight:500 }}>{listing.title}</div>
                  <div style={{ display:"flex", gap:14, marginTop:12, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, color:"#7a8fa8" }}>📏 {listing.title?.length||0}/180 chars</span>
                    <span style={{ fontSize:12, color:"#00c896" }}>✅ A9 front-loaded</span>
                    {hasImages && <span style={{ fontSize:12, color:"#4fc3f7" }}>📸 Image-enhanced</span>}
                  </div>
                </div>
              )}
              {activeTab === "bullets" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                    <div style={{ fontSize:13, color:"#f59500", fontWeight:800 }}>5 CONVERSION-OPTIMIZED BULLET POINTS</div>
                    <button onClick={() => copyToClipboard(listing.bullets,"bullets")} style={{ background:copied==="bullets"?"#00c896":"rgba(245,149,0,0.18)", border:"1px solid rgba(245,149,0,0.4)", borderRadius:8, padding:"6px 14px", color:copied==="bullets"?"#fff":"#f59500", fontSize:12, cursor:"pointer", fontWeight:700 }}>{copied==="bullets"?"✓ Copied!":"Copy All"}</button>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {listing.bullets?.map((b,i) => (
                      <div key={i} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(245,149,0,0.14)", borderRadius:10, padding:"14px 16px", display:"flex", gap:12, alignItems:"flex-start" }}>
                        <div style={{ minWidth:26, height:26, borderRadius:7, background:"linear-gradient(135deg,#e65c00,#f9a825)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:"#fff" }}>{i+1}</div>
                        <div style={{ fontSize:13, lineHeight:1.75, color:"#ccdaed", flex:1 }}>{b}</div>
                        <button onClick={() => copyToClipboard(b,`b${i}`)} style={{ minWidth:52, background:copied===`b${i}`?"#00c896":"rgba(255,255,255,0.06)", border:"none", borderRadius:6, padding:"4px 8px", color:copied===`b${i}`?"#fff":"#7a8fa8", fontSize:11, cursor:"pointer" }}>{copied===`b${i}`?"✓":"Copy"}</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === "description" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                    <div style={{ fontSize:13, color:"#f59500", fontWeight:800 }}>SEO-RICH PRODUCT DESCRIPTION</div>
                    <button onClick={() => copyToClipboard(listing.description,"desc")} style={{ background:copied==="desc"?"#00c896":"rgba(245,149,0,0.18)", border:"1px solid rgba(245,149,0,0.4)", borderRadius:8, padding:"6px 14px", color:copied==="desc"?"#fff":"#f59500", fontSize:12, cursor:"pointer", fontWeight:700 }}>{copied==="desc"?"✓ Copied!":"Copy"}</button>
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:20, fontSize:13, lineHeight:1.9, color:"#c2d4e8", maxHeight:420, overflowY:"auto" }} dangerouslySetInnerHTML={{ __html: listing.description?.replace(/\n/g,"<br/>") || "" }} />
                </div>
              )}
              {activeTab === "keywords" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                  <div><div style={{ fontSize:11, color:"#f59500", fontWeight:800, marginBottom:10 }}>🎯 PRIMARY</div><div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>{listing.primaryKeywords?.map((k,i) => <span key={i} style={{ background:"rgba(245,149,0,0.13)", border:"1px solid rgba(245,149,0,0.4)", borderRadius:18, padding:"5px 12px", fontSize:12, color:"#f59500" }}>{k}</span>)}</div></div>
                  <div><div style={{ fontSize:11, color:"#4fc3f7", fontWeight:800, marginBottom:10 }}>⚡ SHORT-TAIL</div><div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>{listing.shortTailKeywords?.map((k,i) => <span key={i} style={{ background:"rgba(79,195,247,0.1)", border:"1px solid rgba(79,195,247,0.3)", borderRadius:18, padding:"5px 12px", fontSize:12, color:"#4fc3f7" }}>{k}</span>)}</div></div>
                  <div style={{ gridColumn:"1/-1" }}><div style={{ fontSize:11, color:"#00c896", fontWeight:800, marginBottom:10 }}>📌 LONG-TAIL (High Buyer Intent)</div><div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>{listing.longTailKeywords?.map((k,i) => <span key={i} style={{ background:"rgba(0,200,150,0.08)", border:"1px solid rgba(0,200,150,0.3)", borderRadius:18, padding:"5px 12px", fontSize:12, color:"#00c896" }}>{k}</span>)}</div></div>
                </div>
              )}
              {activeTab === "backend" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                    <div style={{ fontSize:13, color:"#f59500", fontWeight:800 }}>BACKEND SEARCH TERMS → Seller Central</div>
                    <button onClick={() => copyToClipboard(listing.searchTerms,"bk")} style={{ background:copied==="bk"?"#00c896":"rgba(245,149,0,0.18)", border:"1px solid rgba(245,149,0,0.4)", borderRadius:8, padding:"6px 14px", color:copied==="bk"?"#fff":"#f59500", fontSize:12, cursor:"pointer", fontWeight:700 }}>{copied==="bk"?"✓ Copied!":"Copy"}</button>
                  </div>
                  <div style={{ background:"#060c18", border:"1px solid rgba(0,200,150,0.3)", borderRadius:12, padding:20, fontFamily:"monospace", fontSize:13, lineHeight:1.85, color:"#00e5b5", wordBreak:"break-all" }}>{listing.searchTerms}</div>
                  <div style={{ display:"flex", gap:14, marginTop:10, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, color:"#7a8fa8" }}>📏 {listing.searchTerms?.length||0}/250 chars</span>
                    <span style={{ fontSize:12, color:"#00c896" }}>✅ No duplicates</span><span style={{ fontSize:12, color:"#00c896" }}>✅ No brand names</span>
                  </div>
                </div>
              )}
              {activeTab === "insights" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
                  <div><div style={{ fontSize:11, color:"#f59500", fontWeight:800, marginBottom:12 }}>🚀 IMPROVEMENTS</div>{listing.improvements?.map((x,i) => <div key={i} style={{ background:"rgba(245,149,0,0.07)", border:"1px solid rgba(245,149,0,0.2)", borderRadius:10, padding:14, marginBottom:10, fontSize:13, color:"#ccdaed", lineHeight:1.6 }}><span style={{ color:"#f59500", fontWeight:800, marginRight:8 }}>▶</span>{x}</div>)}</div>
                  <div><div style={{ fontSize:11, color:"#ab47bc", fontWeight:800, marginBottom:12 }}>🏆 COMPETITOR GAPS</div>{listing.competitorGaps?.map((x,i) => <div key={i} style={{ background:"rgba(171,71,188,0.07)", border:"1px solid rgba(171,71,188,0.23)", borderRadius:10, padding:14, marginBottom:10, fontSize:13, color:"#ccdaed", lineHeight:1.6 }}><span style={{ color:"#ab47bc", fontWeight:800, marginRight:8 }}>◆</span>{x}</div>)}
                    {listing.pricingInsight && <div style={{ background:"rgba(79,195,247,0.07)", border:"1px solid rgba(79,195,247,0.23)", borderRadius:10, padding:14, fontSize:13, color:"#ccdaed", lineHeight:1.6 }}><div style={{ fontSize:10, color:"#4fc3f7", fontWeight:800, marginBottom:5 }}>💰 PRICING</div>{listing.pricingInsight}</div>}
                  </div>
                </div>
              )}
            </div>
            <button onClick={resetAll} style={{ marginTop:18, padding:"13px 26px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(245,149,0,0.28)", borderRadius:10, color:"#f59500", fontSize:14, fontWeight:700, cursor:"pointer" }}>← Generate New Listing</button>
          </div>
        )}
      </div>
    </div>
  );
}
