// 定义常量
const W = 20;
const H = 12;
let world = [];
let seen = []; // 新增：用来记录哪些格子被点亮了
let px = 0, py = 0, pgold = 0;
let gameOver = false;

// 初始化世界
function initWorld() {
    world = new Array(W * H).fill(0); // 0 是 EMPTY
    seen = new Array(W * H).fill(false); // 新增：初始状态全是 false（迷雾）
    // 随机放墙 (25%)
    for (let i = 0; i < (W * H) / 4; i++) placeItem(1); // 1 是 WALL
    // 随机放金币
    for (let i = 0; i < 10; i++) placeItem(2); // 2 是 GOLD
    // 随机放蛇
    for (let i = 0; i < 10; i++) placeItem(3); // 3 是 SNAKE
    
    // 清理出生点
    world[0] = 0; world[1] = 0; world[W] = 0;
    px = 0; py = 0; pgold = 0; gameOver = false;
    
    updateSeen(px, py); // 新增：游戏刚开始，点亮出生点周围
}

function updateSeen(cx, cy) {
    // 照亮玩家周围 2 格的范围
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            let nx = cx + dx, ny = cy + dy;
            // 如果在边界内，标记为已探索
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                seen[ny * W + nx] = true;
            }
        }
    }
}

function placeItem(type) {
    let loc;
    do {
        loc = Math.floor(Math.random() * (W * H));
    } while (world[loc] !== 0);
    world[loc] = type;
}

// 移动逻辑（以向右为例）
function moveRight() {
    if (px + 1 >= W) return 0;
    if (world[py * W + (px + 1)] === 1) return 0;
    px++;
    return checkNewMove();
}

// 顺便把 checkNewMove 完善一下，让它能正确处理吃金币
function checkNewMove() {
    let currentLoc = py * W + px;
    if (world[currentLoc] === 2) { // 吃到金币
        world[currentLoc] = 0;
        pgold++;
        if (pgold >= 5) { 
            alert("🎉 恭喜你，收集满 5 个金币，你赢了！"); 
            gameOver = true; 
            return 2; 
        }
    }
    // 检查四周是否有蛇
    const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
    for (let d of dirs) {
        let nx = px + d[0], ny = py + d[1];
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
            if (world[ny * W + nx] === 3) { 
                alert("💀 哎呀，你被蛇咬死了！");
                gameOver = true; 
                return 3; 
            }
        }
    }
    return 1;
}

// 补全另外三个方向的移动函数
function moveLeft() {
    if (px - 1 < 0) return 0;
    if (world[py * W + (px - 1)] === 1) return 0;
    px--;
    return checkNewMove();
}

function moveUp() {
    if (py - 1 < 0) return 0;
    if (world[(py - 1) * W + px] === 1) return 0;
    py--;
    return checkNewMove();
}

function moveDown() {
    if (py + 1 >= H) return 0;
    if (world[(py + 1) * W + px] === 1) return 0;
    py++;
    return checkNewMove();
}

// 更新键盘监听事件，把四个方向都加上
window.addEventListener('keydown', (e) => {
    if (gameOver) return; // 游戏结束就不响应按键了
    switch(e.key.toLowerCase()) {
        case 'w': moveUp(); break;
        case 'a': moveLeft(); break;
        case 's': moveDown(); break;
        case 'd': moveRight(); break;
    }
    updateSeen(px, py); // 新增：每次移动后更新视野
    render(); // 每次移动完重新渲染画面
});

function render() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    document.getElementById('gold').innerText = pgold;

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            let cell = document.createElement('div');
            cell.className = 'cell';
            
            // 如果这个位置还没被探索过（且不是玩家当前所在位置）
            if (!seen[y * W + x] && !(x === px && y === py)) {
                cell.style.background = '#000'; // 纯黑表示迷雾（你也可以用之前的 #444）
                // 如果想模拟原版的 '#' 号，可以加一句 cell.innerText = '#';
            } else {
                // 已经探索过的地方，正常渲染
                if (x === px && y === py) {
                    cell.classList.add('player');
                } else {
                    let item = world[y * W + x];
                    if (item === 1) cell.classList.add('wall');
                    if (item === 2) { cell.classList.add('gold'); cell.innerText = '★'; }
                    if (item === 3) { cell.classList.add('snake'); cell.innerText = '🐍'; }
                }
            }
            board.appendChild(cell);
        }
    }
}
// 启动游戏
initWorld();
render();