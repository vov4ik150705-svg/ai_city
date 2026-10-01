import { ArrowRight, Briefcase, CircleCheck, CircleDollarSign, LogOut, Trophy } from "lucide-react"
import type { ReactNode } from "react"
import { Card } from "../../components/Card"
import { Tabs } from "../../components/Tabs"
import { Destination } from "../../site"
import {
  bankPicture,
  economyBackingTip,
  economyBankFourth,
  economyBankLevel,
  economyBankRole,
  economyBankShare,
  economyBankSteps,
  economyBurnedChip,
  economyFees,
  economyPayrollChip,
  enterFlow,
  exitFlow,
  exitRules,
  farmBody,
  farmPicture,
  payrollPicture,
  prizeRules,
  prizesBody,
  prizesFlow,
  stockPicture,
  whoIsWho,
  workBody,
  workFlow,
  workRules,
  type EconomyPicture,
} from "../../data/economy"
import { Flow, Rules } from "./Flow"
import { withWord } from "./Term"

const iconProps = { size: 20, "aria-hidden": true } as const

const lightBgTable = "0 .04 .08 .12 .16 .2 .24 .28 .32 .36 .4 .44 .48 .52 .56 .6 .64 .68 .72 .76 .8 .84 .88 1 1 1"

function PictureFilters() {
  return (
    <svg className="economy-filters" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="economy-light-bg" colorInterpolationFilters="sRGB">
        <feComponentTransfer>
          <feFuncR type="table" tableValues={lightBgTable} />
          <feFuncG type="table" tableValues={lightBgTable} />
          <feFuncB type="table" tableValues={lightBgTable} />
        </feComponentTransfer>
      </filter>
      <filter id="economy-dark-bg" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 3 3 3 0 -0.05" />
      </filter>
    </svg>
  )
}

export function EconomyPanel() {
  return (
    <Card variant="glass" className="economy__panel">
      <PictureFilters />
      <Tabs
        label="Economy"
        preload
        tabs={[
          {
            id: "enter",
            label: "Enter",
            icon: <CircleDollarSign {...iconProps} />,
            panel: <EnterTab />,
          },
          {
            id: "work",
            label: "Work",
            icon: <Briefcase {...iconProps} />,
            panel: <WorkTab />,
          },
          {
            id: "exit",
            label: "Exit",
            icon: <LogOut {...iconProps} />,
            panel: <ExitTab />,
          },
          {
            id: "prizes",
            label: "Prizes",
            icon: <Trophy {...iconProps} />,
            panel: <PrizesTab />,
          },
        ]}
      />
    </Card>
  )
}

function FlowColumn({ title, steps, more }: { title: string; steps: readonly EconomyPicture[]; more: string }) {
  return (
    <div className="economy-col economy-col--flow">
      <h3 className="economy-col__title type-label">{title}</h3>
      <Flow steps={steps} />
      <Destination kind="docs" className="economy-more site-arrow-link type-label">
        {more}
        <ArrowRight size={16} aria-hidden="true" />
      </Destination>
    </div>
  )
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="economy-col">
      <h3 className="economy-col__title type-label">{title}</h3>
      {children}
    </div>
  )
}

function EnterTab() {
  return (
    <div className="economy-tab economy-grid economy-grid--stack economy-enter">
      <FlowColumn title="How you get in" steps={enterFlow} more="More on deposits" />
      <Column title="What's what">
        <ul className="economy-who">
          {whoIsWho.map((row) => (
            <li key={row.name}>
              <img
                src={row.src}
                alt=""
                width={row.width}
                height={row.height}
                decoding="async"
                data-bg={row.lightBg === true ? "light" : undefined}
              />
              <span className="economy-who__name type-label">{row.name}</span>
              <span className="economy-who__purpose type-caption">
                {row.term === "backing" ? withWord(row.purpose, "backing", economyBackingTip) : row.purpose}
              </span>
            </li>
          ))}
        </ul>
      </Column>
      <Column title="Fees">
        <table className="economy-fees">
          <tbody>
            {economyFees.map((row) => (
              <tr key={row.label} data-nested={row.nested === true ? "" : undefined}>
                <th scope="row" className="type-caption">
                  {row.label === "Vault entry" ? (
                    <CircleCheck className="economy-fees__mark" size={14} aria-hidden="true" />
                  ) : null}
                  {row.label}
                </th>
                <td className="type-caption">
                  <span className="economy-fees__main">{row.rate}</span>
                  {row.note !== undefined ? <span className="economy-fees__note">{row.note}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Column>
    </div>
  )
}

function WorkTab() {
  return (
    <div className="economy-tab economy-grid economy-grid--pair">
      <FlowColumn title="How work gets paid" steps={workFlow} more="More on Payroll" />
      <Column title="Payroll">
        <div className="economy-payroll">
          <img
            src={payrollPicture.src}
            alt={payrollPicture.alt}
            width={payrollPicture.width}
            height={payrollPicture.height}
            decoding="async"
          />
          <div className="economy-chips">
            <p className="economy-chip economy-chip--burned type-label">{economyBurnedChip}</p>
            <p className="economy-chip type-label">{economyPayrollChip}</p>
          </div>
        </div>
        {workBody.map((paragraph) => (
          <p key={paragraph} className="economy-prose type-caption">
            {paragraph}
          </p>
        ))}
      </Column>
      <Rules rules={workRules} />
    </div>
  )
}

function ExitTab() {
  return (
    <div className="economy-tab economy-grid economy-grid--pair">
      <FlowColumn title="How you cash out" steps={exitFlow} more="More on withdrawals" />
      <Column title="Bank">
        <div className="economy-bank">
          <img src={bankPicture.src} alt={bankPicture.alt} width={bankPicture.width} height={bankPicture.height} decoding="async" />
          <div className="economy-bank__side">
            <dl className="economy-bank__facts">
              {[economyBankRole, economyBankLevel].map((fact) => (
                <div key={fact.label}>
                  <dt className="type-label">{fact.label}</dt>
                  <dd className="type-caption">{fact.text}</dd>
                </div>
              ))}
            </dl>
            <ol className="economy-ladder">
              {economyBankSteps.map((step, index) => (
                <li key={step}>
                  <span className="economy-ladder__level type-label">L{index + 1}</span>
                  <span className="economy-ladder__share type-caption">{step}</span>
                </li>
              ))}
            </ol>
            <p className="economy-bank__fourth type-caption">{economyBankFourth}</p>
          </div>
        </div>
        <p className="economy-prose type-caption">{economyBankShare}</p>
      </Column>
      <Rules rules={exitRules} />
    </div>
  )
}

function PrizesTab() {
  return (
    <div className="economy-tab economy-grid economy-grid--stack economy-prizes-tab">
      <FlowColumn title="Where prizes come from" steps={prizesFlow} more="More on prizes" />
      <Column title="Prizes">
        <div className="economy-prizes">
          {[
            { picture: stockPicture, body: prizesBody, bg: "light" as const },
            { picture: farmPicture, body: farmBody, bg: undefined },
          ].map(({ picture, body, bg }) => (
            <div key={picture.title} className="economy-prize">
              <img
                src={picture.src}
                alt={picture.alt}
                width={picture.width}
                height={picture.height}
                decoding="async"
                data-bg={bg}
              />
              <div>
                <h4 className="economy-prize__title type-label">{picture.title}</h4>
                <p className="economy-prose type-caption">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Column>
      <Rules rules={prizeRules} />
    </div>
  )
}
