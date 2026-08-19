import { Board, Panel, Screen, TopBar } from '@/components/ui';
import { getAll } from '@/lib/data';
import { GRADE_COLORS, n } from '@/lib/format';

export const metadata = { title: 'Аргачлал · Говь-Алтай' };

const STEPS = [
  { n: '01', t: 'Эх өгөгдөл татах', tool: 'ArcGIS REST API', d: 'Вэб газрын зургийн 9 давхарга + ижил үйлчилгээний 2 туслах давхаргыг (сумын төв, сумын мэдээлэл) /query цэгээс хуудаслан бүрэн татна.' },
  { n: '02', t: 'Орон зайн бэлтгэл', tool: 'Project · Clip · Spatial Join', d: 'Геометрийг азимут-эквидистант проекцид (метр) хөрвүүлж (локал алдаа <0.1%), бууц бүрийг сумын полигонд оноож, улсын замыг аймгийн хилээр тайрна.' },
  { n: '03', t: 'Эрэлт ба нийлүүлэлт', tool: 'Demand & Supply points', d: 'Эрэлт: бууц (малчин хүн амын жинтэй) + сумын төвийн суурин хүн ам. Нийлүүлэлт: 18 сумын төв, аймгийн байгууллагыг хүн амд пропорциональ хуваарилсан.' },
  { n: '04', t: 'Ойролцоо байдал', tool: 'Near · Proximity', d: 'Хэрчмийн жигд торон индексээр бууц бүрээс суурин, зам, улсын зам хүртэлх хамгийн богино зайг тооцно (9 850 × ~105 000).' },
  { n: '05', t: 'Бүс ба баяжуулалт', tool: 'Simple Rings · Enrich', d: 'Зайг бүсчилж (сургууль 10/25/50/80, цэцэрлэг 5/15/30/50, зам 2/5/10/20 км) бүс тус бүрийн бууц, өрхийг нэгтгэнэ.' },
  { n: '06', t: 'Хүртээмжийн индекс', tool: 'E2SFCA · Composite', d: 'Сургууль, цэцэрлэг, эмнэлэг тус бүрд Гауссын саарлалттай хоёр шатлалт хөвөгч катчментаар 1000 хүнд ногдох хүртээмжийг бодож, 0–100 индекс болгоно.' },
];

export default async function MethodologyPage() {
  const { meta, aimag } = await getAll();
  const p = meta.parameters;
  const stamp = `${meta.generatedAt.slice(0, 10).replace(/-/g, '.')} ${meta.generatedAt.slice(11, 16)} UTC`;

  return (
    <Screen>
      <TopBar title="Аргачлал ба эх сурвалж">
        <div className="panel flex shrink-0 items-center gap-3 px-3 py-2">
          <div>
            <div className="num text-[12px] text-sand-400">npm run data</div>
            <div className="text-[9.5px] text-ink-500">командаар бүх тооцоолол дахин үүснэ</div>
          </div>
          <a
            href={meta.webmapUrl}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap rounded-lg border border-ink-700 px-2.5 py-1 text-[10.5px] text-teal-500 hover:border-teal-500/40"
          >
            Вэб газрын зураг ↗
          </a>
        </div>
      </TopBar>

      <Board template="minmax(0, 0.88fr) minmax(0, 1.12fr)">
        {/* ---------------- pipeline ---------------- */}
        <Panel
          className="lg:col-span-5"
          title="Аргачлалын урсгал"
          subtitle="ArcGIS Business Analyst-ийн ажлын урсгалын дүйцэл"
          scroll
        >
          <div className="grid grid-cols-2 gap-1.5">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-lg border border-ink-700/70 bg-ink-850/45 p-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="num rounded bg-sand-500/12 px-1 py-px text-[9px] font-semibold text-sand-500 ring-1 ring-sand-500/25">
                    {s.n}
                  </span>
                  <span className="truncate text-[11px] font-semibold text-ink-100">{s.t}</span>
                </div>
                <p className="text-[10px] leading-[1.45] text-ink-400">{s.d}</p>
                <div className="mt-1 inline-block rounded border border-ink-700 px-1.5 py-px text-[8.5px] text-ink-600">
                  {s.tool}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ---------------- formulas ---------------- */}
        <Panel className="lg:col-span-4" title="Томьёо" subtitle="Хүртээмжийн үндсэн тооцооллууд" scroll>
          <div className="space-y-2">
            <Formula
              title="E2SFCA — 1-р алхам: нийлүүлэлт/эрэлтийн харьцаа"
              body="Rⱼ = Sⱼ ⁄ Σₖ ( Dₖ · G(dₖⱼ, d₀) )"
              note="Sⱼ — j суурин дахь байгууллагын тоо, Dₖ — k эрэлтийн цэгийн хүн ам."
            />
            <Formula
              title="E2SFCA — 2-р алхам: хүртээмж"
              body="Aᵢ = Σⱼ ( Rⱼ · G(dᵢⱼ, d₀) )"
              note="Aᵢ × 1000 = «1000 хүнд ногдох байгууллага»."
            />
            <Formula
              title="Гауссын зайн саарлалт"
              body="G(d,d₀) = ( e^(−d²⁄2d₀²) − e^(−0.5) ) ⁄ ( 1 − e^(−0.5) )"
              note={`d ≤ d₀ үед; катчмент — сургууль ${p.catchment.school} км, эмнэлэг ${p.catchment.health} км, цэцэрлэг ${p.catchment.kindergarten} км.`}
            />
            <Formula
              title="Тооцоолсон явах хугацаа"
              body="T = d_зам ⁄ 15 + max(0, d_төв·1.3 − d_зам) ⁄ V_ангилал"
              note="Хээрийн хурд 15 км/ц; замын ангилалын хурд 25–60 км/ц; 1.3 — сүлжээний тойролт."
            />
          </div>
        </Panel>

        {/* ---------------- index structure ---------------- */}
        <Panel className="lg:col-span-3" title="Индексийн бүтэц" subtitle="Бүх бүрэлдэхүүн 0–100" scroll>
          <div className="space-y-2">
            <Formula title="Сургуулийн индекс" body="0.35·C₂₅ + 0.25·C₅₀ + 0.25·Â + 0.15·D̂" />
            <Formula title="Цэцэрлэгийн индекс" body="0.35·C₁₅ + 0.25·C₃₀ + 0.25·Â + 0.15·D̂" />
            <Formula title="Эрүүл мэндийн индекс" body="0.35·C₂₅ + 0.25·C₅₀ + 0.25·Â + 0.15·D̂" note="Эмнэлэг мөн сумын төвд байрлах тул зайн гишүүн сургуультай ижил; зөвхөн нэг хүнд ногдох нийлүүлэлт ялгаатай." />
            <Formula title="Замын индекс" body="0.40·C₅ + 0.20·C₁₀ + 0.25·D̂ + 0.15·C_улсын₂₀" />
            <Formula
              title="Нэгдсэн индекс"
              body="0.5·(0.5·боловсрол + 0.5·эрүүл мэнд) + 0.5·зам"
              note="Боловсрол = 0.55·сургууль + 0.45·цэцэрлэг. Cₓ — босго зайд багтах бууцны хувь; Â — E2SFCA, D̂ — зай/нягтшлийн min–max хэвийнжүүлэлт."
            />
            <div className="rounded-lg border border-ink-700/70 bg-ink-850/45 p-2">
              <div className="mb-1 text-[10px] font-medium text-ink-200">Үнэлгээний ангилал</div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9.5px] text-ink-400">
                <span>Маш их ≥ 80</span>
                <span>Сайн 60–80</span>
                <span>Дунд 40–60</span>
                <span>Бага 20–40</span>
                <span>Маш хангалтгүй &lt; 20</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* ---------------- thresholds ---------------- */}
        <Panel className="lg:col-span-3" title="Босго зай" subtitle="Зайн бүсийн ангилал, км" scroll>
          <div className="space-y-2">
            {(
              [
                ['Сургууль', p.bands.school, 'Өдөр тутмын ирц 25 км хүртэл; 50 км-ээс цааш дотуур байр.'],
                ['Цэцэрлэг', p.bands.kindergarten, 'Бага насны өдөр тутмын зорчилт 15 км-ээс цаашгүй.'],
                ['Авто зам', p.bands.road, 'Бууцнаас аль нэг ангиллын зам хүртэлх хээрийн зам.'],
              ] as [string, number[], string][]
            ).map(([label, bands, note]) => (
              <div key={label}>
                <div className="mb-1 text-[11px] font-medium text-ink-100">{label}</div>
                <div className="flex flex-wrap gap-1">
                  {bands.map((b, i) => (
                    <span
                      key={b}
                      className="num rounded px-1.5 py-px text-[9.5px]"
                      style={{
                        background: `${GRADE_COLORS[i]}1c`,
                        color: GRADE_COLORS[i],
                      }}
                    >
                      {i === 0 ? `0–${b}` : `${bands[i - 1]}–${b}`}
                    </span>
                  ))}
                  <span className="num rounded bg-grade-5/15 px-1.5 py-px text-[9.5px] text-grade-5">
                    {bands[bands.length - 1]}+
                  </span>
                </div>
                <p className="mt-0.5 text-[9.5px] leading-snug text-ink-600">{note}</p>
              </div>
            ))}
          </div>
        </Panel>

        {/* ---------------- assumptions ---------------- */}
        <Panel
          className="lg:col-span-4"
          title="Таамаглал ба хязгаарлалт"
          subtitle="Дүгнэлт хийхдээ анхаарах зүйлс"
          scroll
        >
          <ul className="space-y-1.5 text-[10px] leading-[1.5] text-ink-400">
            <Li c="#e0a33c" t="Байгууллагын байршил.">
              Сургууль, цэцэрлэгийн тоо зөвхөн аймгийн түвшинд байдаг тул {aimag.schools} сургууль,{' '}
              {aimag.kindergartens} цэцэрлэгийг сумын төв бүрд «{p.facilityAllocation}» дүрмээр хуваарилсан.
              Салбар сургууль тусад нь тусгагдаагүй.
            </Li>
            <Li c="#46c9b4" t="Эрэлтийн жин.">
              Малтай {n(aimag.herderHouseholds)} өрхийг {n(aimag.camps)} бууцанд жигд хуваарилсан
              (1 бууц ≈ {n(p.herderHouseholdsPerCamp, 3)} өрх). Нэг өрх өвөлжөө, хаваржаа хоёуланг эзэмшиж
              болох тул бууцны тоо өрхийн тооноос их.
            </Li>
            <Li c="#eab308" t="Зай нь шулуун зай.">
              Network Analyst-ийн маршрутын шинжилгээ хийгээгүй; явах хугацааг 1.3 тойролтын коэффициент
              болон ангилалын хурдаар ойролцоогоор тооцсон. Уулын даваа, гол гарц харгалзаагүй.
            </Li>
            <Li c="#f97316" t="Хугацааны зөрүү.">
              Өрх {aimag.householdYear} он, сургууль {aimag.schoolYear} он, цэцэрлэг{' '}
              {aimag.kindergartenYear} он, хүн ам ЗТХЯ-ны давхаргын сүүлийн утга — бүгд ижил жилийнх биш.
            </Li>
            <Li c="#8b9aa9" t="Талбайн тооцоо.">
              Талбай, уртыг сферийн геометрээр (R = 6 371 км) тооцсон; аймгийн нийт талбай{' '}
              {n(aimag.areaKm2)} км² гарсан нь албан ёсны үзүүлэлттэй ойролцоо. Проекц: {meta.projection}.
            </Li>
          </ul>
        </Panel>

        {/* ---------------- sources ---------------- */}
        <Panel
          className="lg:col-span-5"
          title="Эх өгөгдлийн давхаргууд"
          subtitle={`ArcGIS вэб газрын зураг · ${meta.webmapId}`}
          bodyClass="overflow-auto px-2"
        >
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-ink-900">
              <tr className="border-b border-ink-700 text-[9px] uppercase tracking-wide text-ink-500">
                <th className="px-1.5 py-1 text-left font-medium">Давхарга</th>
                <th className="px-1.5 py-1 text-left font-medium">Шинжилгээн дэх үүрэг</th>
              </tr>
            </thead>
            <tbody>
              {meta.layers.map((l) => (
                <tr key={l.key} className="border-b border-ink-800/60 align-top hover:bg-ink-800/40">
                  <td className="px-1.5 py-1">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-ink-100 underline decoration-ink-700 underline-offset-2 hover:text-teal-500"
                    >
                      {l.title}
                    </a>
                  </td>
                  <td className="px-1.5 py-1 leading-snug text-ink-400">{l.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </Board>
    </Screen>
  );
}

function Formula({ title, body, note }: { title: string; body: string; note?: string }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] font-medium text-ink-100">{title}</div>
      <div className="num overflow-x-auto rounded-lg border border-ink-700/70 bg-ink-950/60 px-2 py-1.5 text-[11px] text-sand-400">
        {body}
      </div>
      {note && <p className="mt-1 text-[9.5px] leading-snug text-ink-600">{note}</p>}
    </div>
  );
}

function Li({ c, t, children }: { c: string; t: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-[6px] size-1.5 shrink-0 rounded-full" style={{ background: c }} />
      <span>
        <b className="text-ink-100">{t}</b> {children}
      </span>
    </li>
  );
}
