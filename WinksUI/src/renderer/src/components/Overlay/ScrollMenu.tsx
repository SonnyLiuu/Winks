import styles from './Overlay.module.css';
import React, { useState } from 'react';
import {
  CircleMenu,
  CircleMenuItem,
} from 'react-circular-menu';

function ScrollMenu(): React.JSX.Element {
  const [scrollMenuOpen, setScrollMenuOpen] = useState(true);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

  const openOverlayGetClick = (): void => {
    window.electron.send('open-overlay-get-click');
  };

  const moveCursorAndScrollUp = (): void => {
    window.electron.send('move-cursor-and-scroll', 'up');
  };

  const moveCursorAndScrollDown = (): void => {
    window.electron.send('move-cursor-and-scroll', 'down');
  };

  return (
    <div className={styles.circleMenuContainer}>
      <div className={`${styles.menuWrapper} ${!scrollMenuOpen ? styles.invisible : ''}`}>
        <CircleMenu
          startAngle={-90}
          rotationAngle={360}
          itemSize={2}
          radius={5}
          rotationAngleInclusive={false}
          onMenuToggle={(open) => {
            setScrollMenuOpen(open);
            if (open) setOptionsMenuOpen(false);
            else setOptionsMenuOpen(true);
          }}
        >
          <CircleMenuItem className={styles.button} onClick={moveCursorAndScrollUp}>
            ↑
          </CircleMenuItem>
          <CircleMenuItem className={styles.button} onClick={moveCursorAndScrollDown}>
            ↓
          </CircleMenuItem>
        </CircleMenu>
      </div>

      <div className={`${styles.menuWrapper} ${!optionsMenuOpen ? styles.invisible : ''}`}>
        <CircleMenu
          startAngle={-90}
          rotationAngle={360}
          itemSize={2}
          radius={5}
          rotationAngleInclusive={false}
          onMenuToggle={(open) => {
            setOptionsMenuOpen(open);
            if (open)
              setScrollMenuOpen(false);
            else
              setScrollMenuOpen(true);
          }}
        >
          <CircleMenuItem className={styles.button} onClick={openOverlayGetClick}>
            •
          </CircleMenuItem>
        </CircleMenu>
      </div>
    </div>
  );
}

export default ScrollMenu;
