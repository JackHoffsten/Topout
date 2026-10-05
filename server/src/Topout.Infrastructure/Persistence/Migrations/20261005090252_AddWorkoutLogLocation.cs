using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkoutLogLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "WorkoutLogs",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Location",
                table: "WorkoutLogs");
        }
    }
}
