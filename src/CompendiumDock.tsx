import { useState } from "react";
import type { PlayerInventory } from "./inventory";
import {
  getCompendiumEntries,
  getCompendiumEntryById,
  type CompendiumEntry,
  type CompendiumKind,
} from "./compendium";
import { useConfigurationLocked } from "./configurationLock";

type DockKind =
  | CompendiumKind
  | "backpack";

const DOCK_TITLES: Record<
  DockKind,
  string
> = {
  weapon: "武器图鉴",
  relic: "遗物图鉴",
  item: "道具图鉴",
  companion: "同伴图鉴",
  status: "状态图鉴",
  backpack: "背包",
};

const DOCK_BUTTON_LABELS: Record<
  DockKind,
  string
> = {
  weapon: "武",
  relic: "遗",
  item: "道",
  companion: "伴",
  status: "状",
  backpack: "包",
};

function CompendiumEntryDetail(props: {
  entry: CompendiumEntry | undefined;
  actionLabel?: string;
  onAction?: () => void;
}) {
    const configurationLocked =
    useConfigurationLocked();
  if (!props.entry) {
    return (
      <div className="entry-detail-empty">
        请选择一个条目。
      </div>
    );
  }

  if (!props.entry.encountered) {
    return (
      <article className="entry-detail-panel">
        <h2>？？？</h2>

        <p className="compendium-description">
          尚未在游戏中遇到这个条目。
        </p>
      </article>
    );
  }

  return (
    <article className="entry-detail-panel">
      <div className="compendium-entry-heading">
        <h2>{props.entry.name}</h2>

        <span className="encountered-mark">
          已遇到
        </span>
      </div>

      <p className="compendium-description">
        {props.entry.description}
      </p>

      <dl className="compendium-details">
        {props.entry.details.map(
          (detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ),
        )}
      </dl>

      <p className="compendium-fairy-comment">
        {props.entry.fairyComment}
      </p>

      {props.actionLabel &&
        props.onAction && (
          <button
            type="button"
            className="primary-button entry-action-button"
            disabled={configurationLocked}
            title={
              configurationLocked
                ? "战斗中不能修改配置"
                : undefined
            }
            onClick={props.onAction}
          >
            {props.actionLabel}
          </button>
        )}
    </article>
  );
}

function CompendiumBrowser(props: {
  kind: CompendiumKind;
}) {
  const entries =
    getCompendiumEntries(props.kind);

  const [query, setQuery] =
    useState("");

  const [
    searchDescription,
    setSearchDescription,
  ] = useState(false);

  const [selectedId, setSelectedId] =
    useState(entries[0]?.id ?? "");

  const [page, setPage] = useState(0);
  const pageSize = 8;

  const normalizedQuery =
    query.trim().toLowerCase();

    const filteredEntries =
    entries.filter((entry) => {
      if (!normalizedQuery) {
        return true;
      }

      /*
       * 描述搜索开启时：
       * 只搜索description，不再搜索名称。
       */
      if (searchDescription) {
        if (!entry.encountered) {
          return false;
        }

        return entry.description
          .toLowerCase()
          .includes(
            normalizedQuery,
          );
      }

      /*
       * 描述搜索关闭时：
       * 只搜索名称。
       */
      if (!entry.encountered) {
        return "？？？".includes(
          normalizedQuery,
        );
      }

      return entry.name
        .toLowerCase()
        .includes(
          normalizedQuery,
        );
    });

  const selectedEntry =
    filteredEntries.find(
      (entry) =>
        entry.id === selectedId,
    ) ??
    filteredEntries[0];

  const pageCount = Math.max(
    1,
    Math.ceil(filteredEntries.length / pageSize),
  );
  const safePage = Math.min(page, pageCount - 1);
  const visibleEntries = filteredEntries.slice(
    safePage * pageSize,
    (safePage + 1) * pageSize,
  );

  return (
    <div className="library-browser">
      <aside className="library-list-panel">
        <div className="compendium-search-row">
          <input
            className="compendium-search"
            value={query}
            placeholder={
              searchDescription
                ? "只搜索描述……"
                : "只搜索名称……"
            }
            onChange={(event) =>
              {
                setQuery(event.target.value);
                setPage(0);
              }
            }
          />

          <button
            type="button"
            className={[
              "description-search-toggle",
              searchDescription
                ? "active"
                : "",
            ].join(" ")}
            aria-pressed={
              searchDescription
            }
            title={
              searchDescription
                ? "当前只搜索描述"
                : "当前只搜索名称"
            }
            onClick={() =>
              {
                setSearchDescription((current) => !current);
                setPage(0);
              }
            }
          >
            描述
          </button>
        </div>

        <p className="compendium-progress">
          已遇到{" "}
          {
            entries.filter(
              (entry) =>
                entry.encountered,
            ).length
          }
          /{entries.length}
        </p>

        <div className="library-entry-list">
          {visibleEntries.map(
            (entry) => (
              <button
                type="button"
                key={entry.id}
                className={[
                  "library-entry-button",
                  entry.id ===
                  selectedEntry?.id
                    ? "selected"
                    : "",
                  entry.encountered
                    ? ""
                    : "unknown",
                ].join(" ")}
                onClick={() =>
                  setSelectedId(entry.id)
                }
              >
                <strong>
                  {entry.encountered
                    ? entry.name
                    : "？？？"}
                </strong>

                <span>
                  {entry.encountered
                    ? "已遇到"
                    : "未遇到"}
                </span>
              </button>
            ),
          )}

          {filteredEntries.length ===
            0 && (
            <p className="empty-list-message">
              没有符合条件的条目。
            </p>
          )}
        </div>

        {filteredEntries.length > pageSize && (
          <div className="compendium-pagination">
            <button
              type="button"
              className="secondary-button"
              disabled={safePage === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              上一页
            </button>
            <span>{safePage + 1} / {pageCount}</span>
            <button
              type="button"
              className="secondary-button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            >
              下一页
            </button>
          </div>
        )}
      </aside>

      <div className="library-detail-column">
        <CompendiumEntryDetail
          entry={selectedEntry}
        />
      </div>
    </div>
  );
}

interface BackpackListEntry {
  id: string;
  section: string;
  status?: string;
}

function BackpackBrowser(props: {
  inventory: PlayerInventory;

  onEquipWeapon: (
    weaponId: string,
  ) => void;

  onEquipItem: (
    itemId: string,
  ) => void;

  onSetCompanionSlot: (
    slotIndex: number,
    companionId: string | null,
  ) => void;
}) {
    const configurationLocked =
    useConfigurationLocked();
  const otherWeaponIds =
    props.inventory.ownedWeaponIds.filter(
      (id) =>
        id !==
        props.inventory
          .equippedWeaponId,
    );

  const otherItemIds =
    props.inventory.ownedItemIds.filter(
      (id) =>
        id !==
        props.inventory.equippedItemId,
    );

  const listEntries:
    BackpackListEntry[] = [
      {
        id:
          props.inventory
            .equippedWeaponId,
        section: "当前武器",
        status: "已装备",
      },

      {
        id:
          props.inventory
            .equippedItemId,
        section: "当前道具",
        status: "已装备",
      },

      ...otherWeaponIds.map(
        (id) => ({
          id,
          section: "其他武器",
          status: "可更换",
        }),
      ),

      ...props.inventory
        .ownedRelicIds
        .map((id) => ({
          id,
          section: "拥有的遗物",
          status: "生效中",
        })),

      ...otherItemIds.map(
        (id) => ({
          id,
          section: "其他道具",
          status: "可更换",
        }),
      ),

      ...props.inventory
        .ownedCompanionIds
        .map((id) => {
          const slotIndex =
            props.inventory
              .companionSlots
              .indexOf(id);

          return {
            id,
            section: "拥有的同伴",

            status:
              slotIndex >= 0
                ? `位置${slotIndex + 1}`
                : "未上阵",
          };
        }),
    ];

  const [selectedId, setSelectedId] =
    useState(
      listEntries[0]?.id ?? "",
    );

 const selectedEntry =
    getCompendiumEntryById(
      selectedId,
    );

  const selectedCompanionSlot =
    selectedEntry?.kind ===
    "companion"
      ? props.inventory
          .companionSlots
          .indexOf(
            selectedEntry.id,
          )
      : -1;

  let actionLabel:
    | string
    | undefined;

  let onAction:
    | (() => void)
    | undefined;

  if (
    selectedEntry?.kind ===
      "weapon" &&
    selectedEntry.id !==
      props.inventory
        .equippedWeaponId &&
    props.inventory.ownedWeaponIds.includes(
      selectedEntry.id,
    )
  ) {
    actionLabel = "装备此武器";

    onAction = () =>
      props.onEquipWeapon(
        selectedEntry.id,
      );
  }

  if (
    selectedEntry?.kind ===
      "item" &&
    selectedEntry.id !==
      props.inventory
        .equippedItemId &&
    props.inventory.ownedItemIds.includes(
      selectedEntry.id,
    )
  ) {
    actionLabel = "装备此道具";

    onAction = () =>
      props.onEquipItem(
        selectedEntry.id,
      );
  }

  const sectionOrder = [
    "当前武器",
    "当前道具",
    "其他武器",
    "拥有的遗物",
    "其他道具",
    "拥有的同伴"
  ];

  return (
    <div className="library-browser">
      <aside className="library-list-panel backpack-list-panel">
        <section className="companion-slot-summary">
          <h3>同伴位置</h3>

          <div className="companion-slot-grid">
            {props.inventory
              .companionSlots
              .map(
                (
                  companionId,
                  slotIndex,
                ) => {
                  const companion =
                    companionId
                      ? getCompendiumEntryById(
                          companionId,
                        )
                      : undefined;

                  return (
                    <button
                      type="button"
                      key={slotIndex}
                      className={[
                        "companion-slot-button",
                        companionId
                          ? "occupied"
                          : "empty",
                      ].join(" ")}
                      disabled={
                        !companionId
                      }
                      onClick={() => {
                        if (
                          companionId
                        ) {
                          setSelectedId(
                            companionId,
                          );
                        }
                      }}
                    >
                      <span>
                        位置
                        {slotIndex + 1}
                      </span>

                      <strong>
                        {companion
                          ?.name ??
                          "空"}
                      </strong>
                    </button>
                  );
                },
              )}
          </div>
        </section>

        <div className="library-entry-list">
          {sectionOrder.map(
            (section) => {
              const sectionEntries =
                listEntries.filter(
                  (entry) =>
                    entry.section ===
                    section,
                );

              return (
                <section
                  className="backpack-section"
                  key={section}
                >
                  <h3>{section}</h3>

                  {sectionEntries.length >
                  0 ? (
                    sectionEntries.map(
                      (item) => {
                        const entry =
                          getCompendiumEntryById(
                            item.id,
                          );

                        return (
                          <button
                            type="button"
                            key={`${section}-${item.id}`}
                            className={[
                              "library-entry-button",
                              item.id ===
                              selectedId
                                ? "selected"
                                : "",
                            ].join(" ")}
                            onClick={() =>
                              setSelectedId(
                                item.id,
                              )
                            }
                          >
                            <strong>
                              {entry?.name ??
                                "未知条目"}
                            </strong>

                            <span>
                              {item.status}
                            </span>
                          </button>
                        );
                      },
                    )
                  ) : (
                    <p className="empty-backpack-section">
                      暂无
                    </p>
                  )}
                </section>
              );
            },
          )}
        </div>
      </aside>

      <div className="library-detail-column">
        <CompendiumEntryDetail
          entry={selectedEntry}
          actionLabel={actionLabel}
          onAction={onAction}
        />

        {selectedEntry?.kind ===
          "companion" && (
          <section className="companion-position-controls">
            <h3>分配同伴位置</h3>

            <p>
              当前：
              {selectedCompanionSlot >=
              0
                ? `位置${selectedCompanionSlot + 1}`
                : "未上阵"}
            </p>

            <div className="companion-position-button-grid">
              {props.inventory
                .companionSlots
                .map(
                  (
                    occupantId,
                    slotIndex,
                  ) => {
                    const isCurrentSlot =
                      occupantId ===
                      selectedEntry.id;

                    const occupant =
                      occupantId
                        ? getCompendiumEntryById(
                            occupantId,
                          )
                        : undefined;

                    return (
                      <button
                        type="button"
                        key={slotIndex}
                        className={[
                          "secondary-button",
                          "companion-position-button",
                          isCurrentSlot
                            ? "current"
                            : "",
                        ].join(" ")}
                        disabled={configurationLocked}
                        title={
                          configurationLocked
                            ? "战斗中不能调整同伴"
                            : undefined
                        }
                        onClick={() =>
                          props.onSetCompanionSlot(
                            slotIndex,

                            isCurrentSlot
                              ? null
                              : selectedEntry.id,
                          )
                        }
                      >
                        {isCurrentSlot
                          ? `从位置${slotIndex + 1}卸下`
                          : occupant
                            ? `替换位置${slotIndex + 1}的${occupant.name}`
                            : `放入位置${slotIndex + 1}`}
                      </button>
                    );
                  },
                )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CompendiumDock(props: {
  inventory: PlayerInventory;

  onEquipWeapon: (
    weaponId: string,
  ) => void;

  onEquipItem: (
    itemId: string,
  ) => void;

  onSetCompanionSlot: (
    slotIndex: number,
    companionId: string | null,
  ) => void;
}) {
  const [
    openedKind,
    setOpenedKind,
  ] = useState<DockKind | null>(
    null,
  );

  const dockKinds: DockKind[] = [
    "weapon",
    "relic",
    "item",
    "companion",
    "status",
    "backpack",
  ];

  return (
    <>
      <aside
        className="compendium-dock"
        aria-label="图鉴和背包按钮"
      >
        {dockKinds.map((kind) => (
          <button
            type="button"
            key={kind}
            className={[
              "compendium-dock-button",
              openedKind === kind
                ? "active"
                : "",
            ].join(" ")}
            title={DOCK_TITLES[kind]}
            aria-label={
              DOCK_TITLES[kind]
            }
            onClick={() =>
              setOpenedKind(
                openedKind === kind
                  ? null
                  : kind,
              )
            }
          >
            <strong>
              {
                DOCK_BUTTON_LABELS[
                  kind
                ]
              }
            </strong>

            <span>
              {DOCK_TITLES[kind]}
            </span>
          </button>
        ))}
      </aside>

      {openedKind && (
        <div
          className="compendium-overlay"
          onMouseDown={() =>
            setOpenedKind(null)
          }
        >
          <section
            className="compendium-window panel"
            role="dialog"
            aria-modal="true"
            aria-label={
              DOCK_TITLES[openedKind]
            }
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <header className="compendium-header">
              <div>
                <p className="eyebrow">
                  {openedKind ===
                  "backpack"
                    ? "INVENTORY"
                    : "COMPENDIUM"}
                </p>

                <h1>
                  {
                    DOCK_TITLES[
                      openedKind
                    ]
                  }
                </h1>
              </div>

              <button
                type="button"
                className="compendium-close-button"
                aria-label="关闭"
                onClick={() =>
                  setOpenedKind(null)
                }
              >
                ×
              </button>
            </header>

            <div className="compendium-window-content">
              {openedKind ===
              "backpack" ? (
               <BackpackBrowser
                  inventory={
                    props.inventory
                  }
                  onEquipWeapon={
                    props.onEquipWeapon
                  }
                  onEquipItem={
                    props.onEquipItem
                  }
                  onSetCompanionSlot={
                    props.onSetCompanionSlot
                  }
                />
              ) : (
                <CompendiumBrowser
                  key={openedKind}
                  kind={openedKind}
                />
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default CompendiumDock;