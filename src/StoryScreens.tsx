import { useState } from "react";
import {
  PROTAGONISTS,
  type CharacterStats,
  type StoryPage,
} from "./content";


function StoryContent(props: {
  content: StoryPage;
}) {
  if (typeof props.content === "string") {
    return (
      <div className="story-text">
        {props.content}
      </div>
    );
  }

  return (
    <div className="story-text dialogue-container">
      {props.content.map((line, index) => (
        <div
          className={`dialogue-line speaker-${line.speaker}`}
          key={`${line.speaker}-${index}`}
        >
          {line.name && (
            <strong className="speaker-name">
              {line.name}
            </strong>
          )}

          <div className="dialogue-content">
            {line.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function StoryScreen(props: {
  title: string;
  text: StoryPage;
  currentPage: number;
  pageCount: number;
  nextLabel?: string;
  onNext: () => void;
}) {
  return (
    <main className="screen story-screen">
      <section className="panel story-panel">
        <header className="story-header">
          <h1>{props.title}</h1>

          <span className="page-indicator">
            {props.currentPage + 1} / {props.pageCount}
          </span>
        </header>

        <StoryContent content={props.text} />

        <div className="button-row right">
          <button
            className="primary-button"
            onClick={props.onNext}
          >
            {props.nextLabel ?? "继续"}
          </button>
        </div>
      </section>
    </main>
  );
}

function CharacterSelectScreen(props: {
  selectedId: string;
  onSelect: (id: string) => void;
  onConfirm: () => void;
}) {
  const [showStats, setShowStats] = useState(false);

  return (
    <main className="screen">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PLAYER CHARACTER</p>
            <h1>选择主控角色</h1>
          </div>

          <button
            className="secondary-button"
            onClick={() => setShowStats((value) => !value)}
          >
            {showStats ? "查看人物介绍" : "查看战斗数值"}
          </button>
        </div>

        <p className="muted-text">
          在这里填写选择主控前的提示。
        </p>

        <div className="character-grid">
          {PROTAGONISTS.map((character) => {
            const selected = character.id === props.selectedId;

            return (
              <button
                type="button"
                key={character.id}
                className={`character-card ${selected ? "selected" : ""
                  }`}
                onClick={() => props.onSelect(character.id)}
              >
                <h2>{character.name}</h2>

                {showStats ? (
                  <CharacterStatsView
                    stats={character.stats}
                    description={character.combatDescription}
                  />
                ) : (
                  <p className="character-description">
                    {character.realityDescription}
                  </p>
                )}

                <span className="select-mark">
                  {selected ? "已选择" : "选择"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="button-row right">
          <button
            className="primary-button"
            onClick={props.onConfirm}
          >
            确认主控
          </button>
        </div>
      </section>
    </main>
  );
}

function CharacterStatsView(props: {
  stats: CharacterStats;
  description: string;
}) {
  const stats = [
    ["生命", props.stats.maxHp],
    ["攻击", props.stats.attack],
    ["防御", props.stats.defense],
    ["速度", props.stats.speed],
    ["行动力", props.stats.actionPower],
    ["力量", props.stats.strength],
    ["敏捷", props.stats.agility],
    ["体质", props.stats.constitution],
    ["智力", props.stats.intelligence],
    ["感知", props.stats.perception],
    ["魅力", props.stats.charisma],
  ];

  return (
    <>
      <p className="character-description">
        {props.description}
      </p>

      <div className="stat-grid">
        {stats.map(([name, value]) => (
          <div className="stat-item" key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

function TutorialChoiceScreen(props: {
  onReview: () => void;
  onSkip: () => void;
}) {
  return (
    <main className="screen story-screen">
      <section className="panel choice-panel">
        <p className="eyebrow">TUTORIAL</p>
        <h1>检测到新手教程</h1>

        <div className="story-text">

          {"\n"}
          在这里填写主控发现教程重新开始时的反应。
        </div>

        <div className="choice-list">
          <button
            className="choice-button"
            onClick={props.onReview}
          >
            <strong>就当复习一下吧</strong>
            <span>进入教堂并进行教程战斗。</span>
          </button>

          <button
            className="choice-button"
            onClick={props.onSkip}
          >
            <strong>跳过</strong>
            <span>直接查看教程结果摘要。</span>
          </button>
        </div>
      </section>
    </main>
  );
}

export {
  StoryScreen,
  CharacterSelectScreen,
  TutorialChoiceScreen,
};
