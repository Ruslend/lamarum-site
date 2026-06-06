from aiogram.fsm.state import State, StatesGroup


class TrialLessonForm(StatesGroup):
    name = State()
    grade = State()
    difficulties = State()
    contact = State()
